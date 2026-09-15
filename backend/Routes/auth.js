const express = require("express");
const crypto = require("crypto");
const mongoose = require("mongoose");
const Account = require("../Model/Account");
const PasswordResetHistory = require("../Model/PasswordResetHistory");
const PasswordResetOTP = require("../Model/PasswordResetOTP");
const LoginHistory = require("../Model/LoginHistory");
const OTPVerification = require("../Model/OTPVerification");
const TrustedDevice = require("../Model/TrustedDevice");
const SessionManagement = require("../Model/SessionManagement");
const LoginAttempt = require("../Model/LoginAttempt");
const { recordLogin } = require("../utils/loginActivity");
const { sendOTPEmail, generateOTP } = require("../utils/emailService");
const { getDeviceInfo, detectDeviceChanges, isSameDevice } = require("../utils/deviceFingerprint");
const { checkRateLimit, recordLoginAttempt, isDuplicateLoginRequest, checkAccountLockout } = require("../utils/authSecurity");
const { 
  generateRandomPassword, 
  sendPasswordResetOTPEmail, 
  sendTemporaryPasswordEmail, 
  checkPasswordResetRateLimit, 
  isDuplicatePasswordResetRequest, 
  getPasswordResetHistory 
} = require("../utils/passwordResetService");
require("dotenv").config();

const router = express.Router();
const emailPattern = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])\S{10,72}$/;
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

/**
 * Check if browser is Google Chrome
 * @param {Object} req - Express request object
 * @returns {boolean} - True if browser is Chrome
 */
const isChromeBrowser = (req) => {
  const userAgent = String(req.headers["user-agent"] || "");
  // Chrome includes "Chrome" in user agent but not "Edg" (Edge) or "OPR" (Opera) or "Safari" without Chrome
  return /Chrome\//.test(userAgent) && !/Edg\/|OPR\/|Safari\//.test(userAgent);
};

/**
 * Check if device is mobile
 * @param {Object} req - Express request object
 * @returns {boolean} - True if device is mobile
 */
const isMobileDevice = (req) => {
  const userAgent = String(req.headers["user-agent"] || "");
  const isTablet = /ipad|tablet|android(?!.*mobile)/i.test(userAgent);
  const isMobile = /mobile|iphone|ipod|android/i.test(userAgent) && !isTablet;
  return isMobile;
};

/**
 * Check if current time is within allowed window for mobile (10:00 AM - 1:00 PM IST)
 * @returns {boolean} - True if current time is within allowed window
 */
const isWithinMobileAccessWindow = () => {
  // Get current time in IST (UTC+5:30)
  const now = new Date();
  const istTime = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const hours = istTime.getUTCHours();
  const minutes = istTime.getUTCMinutes();
  
  // 10:00 AM = 10:00, 1:00 PM = 13:00 in 24-hour format
  const currentTimeInMinutes = hours * 60 + minutes;
  const windowStartInMinutes = 10 * 60; // 10:00 AM
  const windowEndInMinutes = 13 * 60; // 1:00 PM
  
  return currentTimeInMinutes >= windowStartInMinutes && currentTimeInMinutes < windowEndInMinutes;
};

const hashPassword = (password) => new Promise((resolve, reject) => {
  const salt = crypto.randomBytes(16).toString("hex");
  crypto.scrypt(password, `${process.env.PASSWORD_PEPPER || "change-me"}:${salt}`, 64, (error, derived) => {
    if (error) return reject(error);
    resolve(`${salt}:${derived.toString("hex")}`);
  });
});
const verifyPassword = (password, stored) => new Promise((resolve, reject) => {
  const [salt, expected] = String(stored || "").split(":");
  if (!salt || !expected) return resolve(false);
  crypto.scrypt(password, `${process.env.PASSWORD_PEPPER || "change-me"}:${salt}`, 64, (error, derived) => {
    if (error) return reject(error);
    const actual = derived.toString("hex");
    resolve(actual.length === expected.length && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected)));
  });
});
const publicAccount = (account) => ({ id: String(account._id), email: account.email, username: account.username, mustChangePassword: account.mustChangePassword });

/**
 * Generate a session token
 * @param {string} accountId - User account ID
 * @param {string} deviceFingerprint - Device fingerprint
 * @returns {string} - Session token
 */
const generateSessionToken = (accountId, deviceFingerprint) => {
  const payload = `${accountId}:${deviceFingerprint}:${Date.now()}:${Math.random()}`;
  return crypto.createHash("sha256").update(payload).digest("hex");
};

/**
 * Create a new session record
 * @param {Object} data - Session data
 * @returns {Promise<Object>} - Created session
 */
const createSession = async (data) => {
  const sessionToken = generateSessionToken(data.accountId, data.deviceFingerprint);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  const session = await SessionManagement.create({
    accountId: data.accountId,
    sessionToken,
    deviceFingerprint: data.deviceFingerprint,
    browser: data.browser,
    operatingSystem: data.operatingSystem,
    deviceType: data.deviceType,
    deviceModel: data.deviceModel,
    ipAddress: data.ipAddress,
    location: data.location,
    isFirstTimeLogin: data.isFirstTimeLogin,
    requiresVerification: data.requiresVerification,
    isVerified: data.isVerified,
    expiresAt,
  });

  return { session, sessionToken };
};

router.post("/signup", async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const username = String(req.body.username || email.split("@")[0]).trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);
  const password = String(req.body.password || "");
  if (!emailPattern.test(email)) return res.status(400).json({ success: false, message: "Enter a valid email address." });
  if (!passwordPattern.test(password)) return res.status(400).json({ success: false, message: "Password must be 10-72 characters and include uppercase, lowercase, number, and special character." });
  if (!/^[a-z0-9_]{3,24}$/.test(username)) return res.status(400).json({ success: false, message: "Username must be 3-24 letters, numbers, or underscores." });
  if (await Account.findOne({ email })) return res.status(409).json({ success: false, message: "An account with this email already exists. Please log in." });
  if (await Account.findOne({ username })) return res.status(409).json({ success: false, message: "That username is already taken." });
  const account = await Account.create({ email, username, passwordHash: await hashPassword(password) });
  return res.status(201).json({ success: true, account: publicAccount(account) });
});

router.post("/login", async (req, res) => {
  const requestId = crypto.randomUUID(); // Track duplicate requests
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || "");

  try {
    // Get device info
    const deviceInfo = getDeviceInfo(req);

    // Check rate limiting
    const rateLimitCheck = await checkRateLimit(email, deviceInfo.ipAddress);
    if (rateLimitCheck.isEmailRateLimited || rateLimitCheck.isIPRateLimited) {
      await recordLoginAttempt({
        email,
        ipAddress: deviceInfo.ipAddress,
        browser: deviceInfo.browser,
        operatingSystem: deviceInfo.operatingSystem,
        deviceType: deviceInfo.deviceType,
        deviceModel: deviceInfo.deviceModel,
        attemptType: "password",
        status: "failed",
        failureReason: "max-attempts-exceeded",
        requestId,
      });

      return res.status(429).json({
        success: false,
        message: "Too many failed login attempts. Please try again in 15 minutes.",
        retryAfterSeconds: 900,
      });
    }

    // Verify account and password
    const account = await Account.findOne({ email });
    if (!account || !(await verifyPassword(password, account.passwordHash))) {
      await recordLoginAttempt({
        email,
        accountId: account?._id,
        ipAddress: deviceInfo.ipAddress,
        browser: deviceInfo.browser,
        operatingSystem: deviceInfo.operatingSystem,
        deviceType: deviceInfo.deviceType,
        deviceModel: deviceInfo.deviceModel,
        attemptType: "password",
        status: "failed",
        failureReason: "invalid-credentials",
        requestId,
      });

      await recordLogin(req, account?._id, "failed");
      return res.status(401).json({ success: false, message: "No user found with those credentials." });
    }

    // Check account lockout status (too many failed attempts in 1 hour)
    const lockoutStatus = await checkAccountLockout(account._id);
    if (lockoutStatus.isLockedOut) {
      await recordLoginAttempt({
        email,
        accountId: account._id,
        ipAddress: deviceInfo.ipAddress,
        browser: deviceInfo.browser,
        operatingSystem: deviceInfo.operatingSystem,
        deviceType: deviceInfo.deviceType,
        deviceModel: deviceInfo.deviceModel,
        attemptType: "password",
        status: "failed",
        failureReason: "account-locked",
        requestId,
      });

      return res.status(423).json({
        success: false,
        message: `Account temporarily locked due to multiple failed login attempts. Try again after 1 hour.`,
        lockedUntil: new Date(Date.now() + 60 * 60 * 1000),
      });
    }

    // Check mobile device time window restriction
    if (isMobileDevice(req)) {
      if (!isWithinMobileAccessWindow()) {
        await recordLoginAttempt({
          email,
          accountId: account._id,
          ipAddress: deviceInfo.ipAddress,
          browser: deviceInfo.browser,
          operatingSystem: deviceInfo.operatingSystem,
          deviceType: deviceInfo.deviceType,
          deviceModel: deviceInfo.deviceModel,
          attemptType: "password",
          status: "failed",
          failureReason: "mobile-time-restriction",
          requestId,
        });

        await recordLogin(req, account._id, "failed");
        const istTime = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000);
        const currentHour = istTime.getUTCHours();
        const currentMinute = istTime.getUTCMinutes();
        const currentTimeIST = `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;
        return res.status(403).json({
          success: false,
          message: `Mobile device access is restricted to 10:00 AM - 1:00 PM IST. Current time: ${currentTimeIST} IST. Please try again during allowed hours.`,
          accessWindowStart: "10:00 AM",
          accessWindowEnd: "1:00 PM",
          timezone: "IST",
          currentTimeIST: currentTimeIST,
        });
      }
    }

    // Check for duplicate/concurrent login requests
    const isDuplicate = await isDuplicateLoginRequest(account._id, deviceInfo.deviceFingerprint);
    if (isDuplicate) {
      console.warn(`Duplicate login attempt detected for account: ${account._id}`);
      // Don't reject, but flag as suspicious
    }

    // Check if device is trusted and new
    const trustedDevice = await TrustedDevice.findOne({
      accountId: account._id,
      deviceFingerprint: deviceInfo.deviceFingerprint,
      isTrusted: true,
      isActive: true,
    });

    const isFirstTimeLogin = !trustedDevice;
    let deviceChangesDetected = null;

    // If not first time, check for device changes
    if (!isFirstTimeLogin && trustedDevice) {
      deviceChangesDetected = detectDeviceChanges(deviceInfo, {
        browser: trustedDevice.browser,
        operatingSystem: trustedDevice.operatingSystem,
        deviceType: trustedDevice.deviceType,
        deviceModel: trustedDevice.deviceModel,
        ipAddress: trustedDevice.ipAddress,
        location: trustedDevice.location,
        deviceFingerprint: trustedDevice.deviceFingerprint,
      });

      // Update last used time
      trustedDevice.lastUsedAt = new Date();
      await trustedDevice.save();
    }

    // Check if browser is Chrome - require OTP verification
    const requiresOTP = isChromeBrowser(req);

    if (requiresOTP) {
      // Generate OTP
      const otpCode = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // OTP expires in 10 minutes

      // Save OTP to database
      const otpRecord = await OTPVerification.findOneAndUpdate(
        { accountId: account._id, isVerified: false },
        {
          accountId: account._id,
          email: account.email,
          otpCode,
          attempts: 0,
          isVerified: false,
          expiresAt,
        },
        { upsert: true, new: true }
      );

      // Send OTP email
      const emailSent = await sendOTPEmail(account.email, otpCode);
      if (!emailSent) {
        await recordLoginAttempt({
          email,
          accountId: account._id,
          ipAddress: deviceInfo.ipAddress,
          browser: deviceInfo.browser,
          operatingSystem: deviceInfo.operatingSystem,
          deviceType: deviceInfo.deviceType,
          deviceModel: deviceInfo.deviceModel,
          attemptType: "password",
          status: "failed",
          failureReason: "network-error",
          requestId,
        });

        await recordLogin(req, account._id, "failed");
        return res.status(500).json({
          success: false,
          message: "Failed to send OTP email. Please try again.",
        });
      }

      // Create session with pending verification
      const { sessionToken } = await createSession({
        accountId: account._id,
        deviceFingerprint: deviceInfo.deviceFingerprint,
        browser: deviceInfo.browser,
        operatingSystem: deviceInfo.operatingSystem,
        deviceType: deviceInfo.deviceType,
        deviceModel: deviceInfo.deviceModel,
        ipAddress: deviceInfo.ipAddress,
        location: deviceInfo.location,
        isFirstTimeLogin,
        requiresVerification: true,
        isVerified: false,
      });

      await recordLoginAttempt({
        email,
        accountId: account._id,
        ipAddress: deviceInfo.ipAddress,
        browser: deviceInfo.browser,
        operatingSystem: deviceInfo.operatingSystem,
        deviceType: deviceInfo.deviceType,
        deviceModel: deviceInfo.deviceModel,
        attemptType: "password",
        status: "success",
        requestId,
      });

      await recordLogin(req, account._id, "success");

      return res.status(202).json({
        success: true,
        requiresOTP: true,
        message: "OTP has been sent to your registered email address. Please verify to complete login.",
        email: account.email,
        accountId: String(account._id),
        sessionToken,
        otpExpiresIn: 600, // 10 minutes in seconds
        isFirstTimeLogin,
        deviceChanges: deviceChangesDetected,
      });
    }

    // Normal login for non-Chrome browsers
    const { sessionToken } = await createSession({
      accountId: account._id,
      deviceFingerprint: deviceInfo.deviceFingerprint,
      browser: deviceInfo.browser,
      operatingSystem: deviceInfo.operatingSystem,
      deviceType: deviceInfo.deviceType,
      deviceModel: deviceInfo.deviceModel,
      ipAddress: deviceInfo.ipAddress,
      location: deviceInfo.location,
      isFirstTimeLogin,
      requiresVerification: false,
      isVerified: true,
    });

    await recordLoginAttempt({
      email,
      accountId: account._id,
      ipAddress: deviceInfo.ipAddress,
      browser: deviceInfo.browser,
      operatingSystem: deviceInfo.operatingSystem,
      deviceType: deviceInfo.deviceType,
      deviceModel: deviceInfo.deviceModel,
      attemptType: "password",
      status: "success",
      requestId,
    });

    await recordLogin(req, account._id, "success");

    return res.json({
      success: true,
      account: publicAccount(account),
      sessionToken,
      isFirstTimeLogin,
      deviceChanges: deviceChangesDetected,
    });
  } catch (error) {
    console.error("Login error:", error.message);
    return res.status(500).json({
      success: false,
      message: "An error occurred during login. Please try again.",
    });
  }
});

router.get("/login-history/:accountId", async (req, res) => {
  try {
    const rawIdentifier = String(req.params.accountId || "").trim();
    if (!rawIdentifier) {
      return res.status(400).json({ success: false, message: "Missing account identifier." });
    }

    let accountId = rawIdentifier;
    if (mongoose.isValidObjectId(rawIdentifier)) {
      accountId = rawIdentifier;
    } else {
      const account = await Account.findOne({
        $or: [
          { email: normalizeEmail(rawIdentifier) },
          { username: String(rawIdentifier).trim().toLowerCase() },
        ],
      }).select("_id").lean();
      if (!account) return res.status(404).json({ success: false, message: "Account not found." });
      accountId = String(account._id);
    }

    const account = await Account.exists({ _id: accountId });
    if (!account) return res.status(404).json({ success: false, message: "Account not found." });

    const history = await LoginHistory.find({ accountId })
      .select("browser operatingSystem deviceType deviceModel ipAddress location loggedInAt status")
      .sort({ loggedInAt: -1 })
      .limit(50)
      .lean();
    return res.json({ success: true, history });
  } catch (error) {
    console.error("Login history error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to load login history." });
  }
});

router.post("/change-password", async (req, res) => {
  const account = await Account.findById(String(req.body.accountId || ""));
  const password = String(req.body.newPassword || "");
  if (!account) return res.status(401).json({ success: false, message: "Your account session is invalid." });
  if (!passwordPattern.test(password)) return res.status(400).json({ success: false, message: "Password must be 10-72 characters and include uppercase, lowercase, number, and special character." });
  account.passwordHash = await hashPassword(password);
  account.mustChangePassword = false;
  await account.save();
  return res.json({ success: true, account: publicAccount(account) });
});

router.post("/verify-otp", async (req, res) => {
  const accountId = String(req.body.accountId || "");
  const otpCode = String(req.body.otpCode || "").trim();
  const trustDevice = req.body.trustDevice === true;
  const deviceName = String(req.body.deviceName || "").trim().slice(0, 100);

  try {
    if (!accountId || !otpCode) {
      return res.status(400).json({
        success: false,
        message: "Account ID and OTP code are required.",
      });
    }

    if (otpCode.length !== 6 || !/^\d+$/.test(otpCode)) {
      return res.status(400).json({
        success: false,
        message: "OTP must be a 6-digit code.",
      });
    }

    const account = await Account.findById(accountId);
    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found.",
      });
    }

    const otpRecord = await OTPVerification.findOne({
      accountId,
      isVerified: false,
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "No active OTP request found. Please log in again.",
      });
    }

    // Check if OTP has expired
    if (new Date() > otpRecord.expiresAt) {
      await OTPVerification.deleteOne({ _id: otpRecord._id });
      return res.status(410).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    // Check if max attempts exceeded
    if (otpRecord.attempts >= otpRecord.maxAttempts) {
      await OTPVerification.deleteOne({ _id: otpRecord._id });
      
      await recordLoginAttempt({
        email: account.email,
        accountId: account._id,
        ipAddress: String(req.ip || "unknown"),
        attemptType: "otp",
        status: "failed",
        failureReason: "max-attempts-exceeded",
      });

      return res.status(429).json({
        success: false,
        message: `Maximum OTP verification attempts exceeded. Please log in again and request a new OTP.`,
      });
    }

    // Verify OTP
    if (otpRecord.otpCode !== otpCode) {
      otpRecord.attempts += 1;
      await otpRecord.save();

      await recordLoginAttempt({
        email: account.email,
        accountId: account._id,
        ipAddress: String(req.ip || "unknown"),
        attemptType: "otp",
        status: "failed",
        failureReason: "invalid-otp",
      });

      const remainingAttempts = otpRecord.maxAttempts - otpRecord.attempts;
      return res.status(401).json({
        success: false,
        message: `Invalid OTP. ${remainingAttempts} attempt(s) remaining.`,
        remainingAttempts,
      });
    }

    // OTP verified successfully
    otpRecord.isVerified = true;
    await otpRecord.save();

    // Get device info
    const deviceInfo = getDeviceInfo(req);

    // Update session to mark as verified
    const session = await SessionManagement.findOneAndUpdate(
      { accountId, requiresVerification: true, isActive: true },
      { isVerified: true, lastActivityAt: new Date() },
      { new: true }
    );

    // Handle device trust logic
    let trustedDevice = null;
    if (trustDevice) {
      trustedDevice = await TrustedDevice.findOneAndUpdate(
        { accountId, deviceFingerprint: deviceInfo.deviceFingerprint },
        {
          accountId,
          deviceFingerprint: deviceInfo.deviceFingerprint,
          deviceName: deviceName || `${deviceInfo.browser.name} on ${deviceInfo.operatingSystem.name}`,
          browser: deviceInfo.browser,
          operatingSystem: deviceInfo.operatingSystem,
          deviceType: deviceInfo.deviceType,
          deviceModel: deviceInfo.deviceModel,
          ipAddress: deviceInfo.ipAddress,
          location: deviceInfo.location,
          isTrusted: true,
          trustedAt: new Date(),
          lastVerifiedAt: new Date(),
          verificationCount: 1,
          isActive: true,
        },
        { upsert: true, new: true }
      );
    } else {
      // Mark as trusted but not permanently (session-level trust)
      trustedDevice = await TrustedDevice.findOne({
        accountId,
        deviceFingerprint: deviceInfo.deviceFingerprint,
      });

      if (!trustedDevice) {
        trustedDevice = await TrustedDevice.create({
          accountId,
          deviceFingerprint: deviceInfo.deviceFingerprint,
          deviceName: deviceName || `${deviceInfo.browser.name} on ${deviceInfo.operatingSystem.name}`,
          browser: deviceInfo.browser,
          operatingSystem: deviceInfo.operatingSystem,
          deviceType: deviceInfo.deviceType,
          deviceModel: deviceInfo.deviceModel,
          ipAddress: deviceInfo.ipAddress,
          location: deviceInfo.location,
          isTrusted: false, // Will require OTP verification next time
          lastVerifiedAt: new Date(),
          verificationCount: 1,
          isActive: true,
        });
      } else {
        trustedDevice.lastVerifiedAt = new Date();
        trustedDevice.verificationCount = (trustedDevice.verificationCount || 0) + 1;
        await trustedDevice.save();
      }
    }

    await recordLoginAttempt({
      email: account.email,
      accountId: account._id,
      ipAddress: deviceInfo.ipAddress,
      browser: deviceInfo.browser,
      operatingSystem: deviceInfo.operatingSystem,
      deviceType: deviceInfo.deviceType,
      deviceModel: deviceInfo.deviceModel,
      location: deviceInfo.location,
      attemptType: "otp",
      status: "success",
    });

    // Record login to LoginHistory for audit trail
    await recordLogin(req, account._id, "success");

    return res.json({
      success: true,
      message: "Email verified successfully.",
      account: publicAccount(account),
      sessionToken: session?.sessionToken,
      deviceTrusted: trustDevice && trustedDevice?.isTrusted,
    });
  } catch (error) {
    console.error("OTP verification error:", error.message);
    return res.status(500).json({
      success: false,
      message: "An error occurred during OTP verification. Please try again.",
    });
  }
});

router.post("/resend-otp", async (req, res) => {
  const accountId = String(req.body.accountId || "");

  if (!accountId) {
    return res.status(400).json({
      success: false,
      message: "Account ID is required.",
    });
  }

  const account = await Account.findById(accountId);
  if (!account) {
    return res.status(404).json({
      success: false,
      message: "Account not found.",
    });
  }

  const otpRecord = await OTPVerification.findOne({
    accountId,
    isVerified: false,
  });

  if (!otpRecord) {
    return res.status(400).json({
      success: false,
      message: "No active OTP request found. Please log in again.",
    });
  }

  // Generate new OTP
  const newOTPCode = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // OTP expires in 10 minutes

  otpRecord.otpCode = newOTPCode;
  otpRecord.attempts = 0; // Reset attempts
  otpRecord.expiresAt = expiresAt;
  await otpRecord.save();

  // Send new OTP email
  const emailSent = await sendOTPEmail(account.email, newOTPCode);
  if (!emailSent) {
    return res.status(500).json({
      success: false,
      message: "Failed to resend OTP email. Please try again.",
    });
  }

  return res.json({
    success: true,
    message: "New OTP has been sent to your email address.",
    otpExpiresIn: 600, // 10 minutes in seconds
  });
});

// ===== Session Management Endpoints =====

router.get("/active-sessions/:accountId", async (req, res) => {
  try {
    const accountId = String(req.params.accountId || "");

    const account = await Account.exists({ _id: accountId });
    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found.",
      });
    }

    const sessions = await SessionManagement.find({
      accountId,
      isActive: true,
      expiresAt: { $gt: new Date() },
    })
      .select("sessionToken browser operatingSystem deviceType deviceModel ipAddress location loginAt lastActivityAt isFirstTimeLogin isVerified")
      .sort({ lastActivityAt: -1 })
      .lean();

    return res.json({
      success: true,
      sessions: sessions.map((s) => ({
        id: String(s._id),
        browser: s.browser,
        operatingSystem: s.operatingSystem,
        deviceType: s.deviceType,
        deviceModel: s.deviceModel,
        ipAddress: s.ipAddress,
        location: s.location,
        loginAt: s.loginAt,
        lastActivityAt: s.lastActivityAt,
        isFirstTimeLogin: s.isFirstTimeLogin,
        isVerified: s.isVerified,
      })),
    });
  } catch (error) {
    console.error("Error fetching active sessions:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch active sessions.",
    });
  }
});

router.get("/trusted-devices/:accountId", async (req, res) => {
  try {
    const accountId = String(req.params.accountId || "");

    const account = await Account.exists({ _id: accountId });
    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found.",
      });
    }

    const devices = await TrustedDevice.find({
      accountId,
      isActive: true,
    })
      .select("deviceName browser operatingSystem deviceType deviceModel ipAddress location isTrusted lastUsedAt lastVerifiedAt verificationCount")
      .sort({ lastUsedAt: -1 })
      .lean();

    return res.json({
      success: true,
      devices: devices.map((d) => ({
        id: String(d._id),
        deviceName: d.deviceName,
        browser: d.browser,
        operatingSystem: d.operatingSystem,
        deviceType: d.deviceType,
        deviceModel: d.deviceModel,
        ipAddress: d.ipAddress,
        location: d.location,
        isTrusted: d.isTrusted,
        lastUsedAt: d.lastUsedAt,
        lastVerifiedAt: d.lastVerifiedAt,
        verificationCount: d.verificationCount,
      })),
    });
  } catch (error) {
    console.error("Error fetching trusted devices:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch trusted devices.",
    });
  }
});

router.post("/trust-device/:deviceId", async (req, res) => {
  try {
    const deviceId = String(req.params.deviceId || "");
    const accountId = String(req.body.accountId || "");
    const deviceName = String(req.body.deviceName || "").trim().slice(0, 100);

    const device = await TrustedDevice.findOneAndUpdate(
      { _id: deviceId, accountId },
      {
        isTrusted: true,
        trustedAt: new Date(),
        lastVerifiedAt: new Date(),
        deviceName: deviceName || undefined,
      },
      { new: true }
    );

    if (!device) {
      return res.status(404).json({
        success: false,
        message: "Device not found.",
      });
    }

    return res.json({
      success: true,
      message: "Device marked as trusted.",
      device: {
        id: String(device._id),
        deviceName: device.deviceName,
        isTrusted: device.isTrusted,
        trustedAt: device.trustedAt,
      },
    });
  } catch (error) {
    console.error("Error trusting device:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to trust device.",
    });
  }
});

router.post("/revoke-device/:deviceId", async (req, res) => {
  try {
    const deviceId = String(req.params.deviceId || "");
    const accountId = String(req.body.accountId || "");

    const device = await TrustedDevice.findOneAndUpdate(
      { _id: deviceId, accountId },
      { isActive: false, isTrusted: false },
      { new: true }
    );

    if (!device) {
      return res.status(404).json({
        success: false,
        message: "Device not found.",
      });
    }

    // Log out any active sessions from this device
    await SessionManagement.updateMany(
      { accountId, deviceFingerprint: device.deviceFingerprint, isActive: true },
      {
        isActive: false,
        logoutAt: new Date(),
        logoutReason: "device-untrustworthy",
      }
    );

    return res.json({
      success: true,
      message: "Device revoked and all active sessions logged out.",
    });
  } catch (error) {
    console.error("Error revoking device:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to revoke device.",
    });
  }
});

router.post("/logout-other-sessions", async (req, res) => {
  try {
    const accountId = String(req.body.accountId || "");
    const currentSessionToken = String(req.body.sessionToken || "");

    if (!accountId || !currentSessionToken) {
      return res.status(400).json({
        success: false,
        message: "Account ID and session token are required.",
      });
    }

    const result = await SessionManagement.updateMany(
      {
        accountId,
        sessionToken: { $ne: currentSessionToken },
        isActive: true,
      },
      {
        isActive: false,
        logoutAt: new Date(),
        logoutReason: "user-logout",
      }
    );

    return res.json({
      success: true,
      message: `Signed out from ${result.modifiedCount} other session(s).`,
      loggedOutCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error logging out other sessions:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to log out other sessions.",
    });
  }
});

router.post("/logout", async (req, res) => {
  try {
    const accountId = String(req.body.accountId || "");
    const sessionToken = String(req.body.sessionToken || "");

    if (!accountId || !sessionToken) {
      return res.status(400).json({
        success: false,
        message: "Account ID and session token are required.",
      });
    }

    const session = await SessionManagement.findOneAndUpdate(
      { accountId, sessionToken, isActive: true },
      {
        isActive: false,
        logoutAt: new Date(),
        logoutReason: "user-logout",
      },
      { new: true }
    );

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found or already logged out.",
      });
    }

    await recordLoginAttempt({
      email: (await Account.findById(accountId))?.email || "unknown",
      accountId,
      ipAddress: session.ipAddress,
      attemptType: "password",
      status: "success",
    });

    return res.json({
      success: true,
      message: "Logged out successfully.",
    });
  } catch (error) {
    console.error("Error logging out:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to log out.",
    });
  }
});

router.get("/password-reset-history/:accountId", async (req, res) => {
  try {
    const account = await Account.exists({ _id: req.params.accountId });
    if (!account) return res.status(404).json({ success: false, message: "Account not found." });
    const history = await getPasswordResetHistory(req.params.accountId, 50);
    return res.json({ success: true, history });
  } catch (error) {
    console.error("Error fetching password reset history:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch password reset history.",
    });
  }
});

// ===== Password Reset Feature =====

router.post("/forgot-password", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const phoneNumber = String(req.body.phoneNumber || "").trim();
    const method = req.body.method || "email"; // "email" or "sms"

    if (!email && !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "Email address or phone number is required.",
      });
    }

    if (method === "email" && !emailPattern.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email address.",
      });
    }

    if (method === "sms" && !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required for SMS recovery.",
      });
    }

    // Find account by email or phone
    let account;
    let identifier;
    if (method === "email") {
      account = await Account.findOne({ email });
      identifier = email;
    } else {
      account = await Account.findOne({ phone: phoneNumber });
      identifier = phoneNumber;
    }

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "No account found with this " + (method === "email" ? "email address" : "phone number") + ".",
      });
    }

    // Check rate limiting (1 reset per 24 hours)
    const rateLimitCheck = await checkPasswordResetRateLimit(account._id);
    if (!rateLimitCheck.canRequest) {
      return res.status(429).json({
        success: false,
        message: rateLimitCheck.message,
        nextAvailableAt: rateLimitCheck.nextAvailableAt,
        remainingSeconds: rateLimitCheck.remainingSeconds,
      });
    }

    // Check for duplicate requests (same method, within 5 minutes)
    const isDuplicate = await isDuplicatePasswordResetRequest(account._id, method);
    if (isDuplicate) {
      return res.status(429).json({
        success: false,
        message: "A password reset request has already been sent. Please check your email/SMS for the OTP.",
        retryAfterSeconds: 300,
      });
    }

    // Get device info
    const deviceInfo = getDeviceInfo(req);

    // Create password reset history record
    const resetRequest = await PasswordResetHistory.create({
      accountId: account._id,
      email: method === "email" ? email : account.email,
      phoneNumber: method === "sms" ? phoneNumber : account.phone,
      identifier,
      method,
      verificationStatus: "requested",
      ipAddress: deviceInfo.ipAddress,
      location: deviceInfo.location,
      browser: deviceInfo.browser,
      operatingSystem: deviceInfo.operatingSystem,
      deviceType: deviceInfo.deviceType,
      deviceModel: deviceInfo.deviceModel,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24-hour reset window
    });

    // Generate OTP
    const otpCode = generateOTP();
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15-minute expiry

    // Save OTP
    await PasswordResetOTP.create({
      accountId: account._id,
      email: method === "email" ? email : account.email,
      phoneNumber: method === "sms" ? phoneNumber : account.phone,
      otpCode,
      method,
      expiresAt: otpExpiresAt,
      requestId: String(resetRequest._id),
    });

    // Send OTP via selected method
    let emailSent = false;
    if (method === "email") {
      emailSent = await sendPasswordResetOTPEmail(email, otpCode);
    } else if (method === "sms") {
      // TODO: Integrate SMS service (Twilio, etc.)
      console.log(`SMS OTP for ${phoneNumber}: ${otpCode}`);
      emailSent = true; // Placeholder
    }

    if (!emailSent) {
      await PasswordResetHistory.findByIdAndUpdate(resetRequest._id, {
        verificationStatus: "failed",
      });

      return res.status(500).json({
        success: false,
        message: `Failed to send OTP via ${method}. Please try again.`,
      });
    }

    return res.status(202).json({
      success: true,
      message: `OTP has been sent to your registered ${method === "email" ? "email address" : "phone number"}.`,
      accountId: String(account._id),
      resetRequestId: String(resetRequest._id),
      method,
      maskedIdentifier: method === "email" 
        ? email.replace(/(.{2})(.*)(@.*)/, "$1***$3")
        : phoneNumber.replace(/(.{2})(.*)(.{2})/, "$1***$3"),
      otpExpiresIn: 900, // 15 minutes
    });
  } catch (error) {
    console.error("Forgot password error:", error.message);
    return res.status(500).json({
      success: false,
      message: "An error occurred during password reset request. Please try again.",
    });
  }
});

router.post("/verify-password-reset-otp", async (req, res) => {
  try {
    const resetRequestId = String(req.body.resetRequestId || "");
    const otpCode = String(req.body.otpCode || "").trim();

    if (!resetRequestId || !otpCode) {
      return res.status(400).json({
        success: false,
        message: "Reset request ID and OTP code are required.",
      });
    }

    if (otpCode.length !== 6 || !/^\d+$/.test(otpCode)) {
      return res.status(400).json({
        success: false,
        message: "OTP must be a 6-digit code.",
      });
    }

    // Find reset request
    const resetRequest = await PasswordResetHistory.findById(resetRequestId);
    if (!resetRequest) {
      return res.status(404).json({
        success: false,
        message: "Password reset request not found.",
      });
    }

    // Check if reset request has expired (24 hours)
    if (new Date() > resetRequest.expiresAt) {
      await PasswordResetHistory.findByIdAndUpdate(resetRequestId, {
        verificationStatus: "expired",
      });

      return res.status(410).json({
        success: false,
        message: "Password reset request has expired. Please request a new one.",
      });
    }

    // Find OTP record
    const otpRecord = await PasswordResetOTP.findOne({
      requestId: resetRequestId,
      isVerified: false,
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "OTP record not found. Please request password reset again.",
      });
    }

    // Check if OTP has expired
    if (new Date() > otpRecord.expiresAt) {
      await PasswordResetOTP.deleteOne({ _id: otpRecord._id });
      await PasswordResetHistory.findByIdAndUpdate(resetRequestId, {
        verificationStatus: "expired",
      });

      return res.status(410).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    // Check if max attempts exceeded
    if (otpRecord.attempts >= otpRecord.maxAttempts) {
      await PasswordResetOTP.deleteOne({ _id: otpRecord._id });
      await PasswordResetHistory.findByIdAndUpdate(resetRequestId, {
        verificationStatus: "failed",
      });

      return res.status(429).json({
        success: false,
        message: "Maximum OTP verification attempts exceeded. Please request a new password reset.",
      });
    }

    // Verify OTP
    if (otpRecord.otpCode !== otpCode) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      
      await PasswordResetHistory.findByIdAndUpdate(resetRequestId, {
        otpAttempts: otpRecord.attempts,
      });

      const remainingAttempts = otpRecord.maxAttempts - otpRecord.attempts;
      return res.status(401).json({
        success: false,
        message: `Invalid OTP. ${remainingAttempts} attempt(s) remaining.`,
        remainingAttempts,
      });
    }

    // OTP verified successfully
    otpRecord.isVerified = true;
    await otpRecord.save();

    // Generate temporary password (uppercase + lowercase only)
    const temporaryPassword = generateRandomPassword();

    // Update account with temporary password and flag
    const account = await Account.findById(resetRequest.accountId);
    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found.",
      });
    }

    // Hash the temporary password
    const hashedPassword = await new Promise((resolve, reject) => {
      const salt = crypto.randomBytes(16).toString("hex");
      crypto.scrypt(temporaryPassword, `${process.env.PASSWORD_PEPPER || "change-me"}:${salt}`, 64, (error, derived) => {
        if (error) return reject(error);
        resolve(`${salt}:${derived.toString("hex")}`);
      });
    });

    account.passwordHash = hashedPassword;
    account.mustChangePassword = true; // Must change after login
    await account.save();

    // Update reset history
    await PasswordResetHistory.findByIdAndUpdate(resetRequestId, {
      verificationStatus: "verified",
      verifiedAt: new Date(),
      completedAt: new Date(),
      temporaryPasswordGenerated: true,
    });

    // Send temporary password via email/SMS
    let passwordSent = false;
    if (resetRequest.method === "email") {
      passwordSent = await sendTemporaryPasswordEmail(resetRequest.email, temporaryPassword);
    } else if (resetRequest.method === "sms") {
      // TODO: Integrate SMS service to send temporary password
      console.log(`SMS Password for ${resetRequest.phoneNumber}: ${temporaryPassword}`);
      passwordSent = true;
    }

    if (!passwordSent) {
      return res.status(500).json({
        success: false,
        message: "Password reset verification successful, but failed to send temporary password. Please contact support.",
      });
    }

    return res.json({
      success: true,
      message: `Password reset successful. Your temporary password has been sent to your registered ${resetRequest.method}.`,
      accountId: String(account._id),
      mustChangePassword: true,
      note: "You must change your password immediately after your next login.",
    });
  } catch (error) {
    console.error("Password reset OTP verification error:", error.message);
    return res.status(500).json({
      success: false,
      message: "An error occurred during OTP verification. Please try again.",
    });
  }
});

router.post("/resend-password-reset-otp", async (req, res) => {
  try {
    const resetRequestId = String(req.body.resetRequestId || "");

    if (!resetRequestId) {
      return res.status(400).json({
        success: false,
        message: "Reset request ID is required.",
      });
    }

    // Find reset request
    const resetRequest = await PasswordResetHistory.findById(resetRequestId);
    if (!resetRequest) {
      return res.status(404).json({
        success: false,
        message: "Password reset request not found.",
      });
    }

    // Check if reset request has expired
    if (new Date() > resetRequest.expiresAt) {
      await PasswordResetHistory.findByIdAndUpdate(resetRequestId, {
        verificationStatus: "expired",
      });

      return res.status(410).json({
        success: false,
        message: "Password reset request has expired. Please request a new one.",
      });
    }

    // Find existing OTP record
    const otpRecord = await PasswordResetOTP.findOne({
      requestId: resetRequestId,
      isVerified: false,
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "OTP record not found. Please request password reset again.",
      });
    }

    // Check resend limit (max 3 resends in 15 minutes = max 4 OTPs total)
    const resendCount = await PasswordResetOTP.countDocuments({
      requestId: resetRequestId,
      isVerified: false,
    });

    if (resendCount >= 4) {
      return res.status(429).json({
        success: false,
        message: "Maximum OTP resend attempts exceeded. Please request a new password reset.",
      });
    }

    // Generate new OTP
    const newOTPCode = generateOTP();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15-minute expiry

    otpRecord.otpCode = newOTPCode;
    otpRecord.attempts = 0; // Reset attempts
    otpRecord.expiresAt = expiresAt;
    await otpRecord.save();

    // Send new OTP
    let emailSent = false;
    if (resetRequest.method === "email") {
      emailSent = await sendPasswordResetOTPEmail(resetRequest.email, newOTPCode);
    } else if (resetRequest.method === "sms") {
      // TODO: Integrate SMS service
      console.log(`SMS OTP for ${resetRequest.phoneNumber}: ${newOTPCode}`);
      emailSent = true;
    }

    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to resend OTP. Please try again.",
      });
    }

    return res.json({
      success: true,
      message: `New OTP has been sent to your registered ${resetRequest.method}.`,
      otpExpiresIn: 900, // 15 minutes
    });
  } catch (error) {
    console.error("Error resending password reset OTP:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to resend OTP. Please try again.",
    });
  }
});

module.exports = router;
