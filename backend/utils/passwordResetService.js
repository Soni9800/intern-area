const nodemailer = require("nodemailer");
const PasswordResetHistory = require("../Model/PasswordResetHistory");

// Initialize email transporter
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

/**
 * Generate a random password with only uppercase and lowercase letters
 * Length: 12-16 characters
 * @returns {string} - Random password
 */
const generateRandomPassword = () => {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const allChars = uppercase + lowercase;
  const length = Math.floor(Math.random() * 5) + 12; // 12-16 chars
  
  let password = "";
  // Ensure at least one uppercase and one lowercase
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  
  // Fill rest with random chars
  for (let i = 2; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle password
  return password.split("").sort(() => Math.random() - 0.5).join("");
};

/**
 * Send password reset OTP to email
 * @param {string} email - User's email address
 * @param {string} otpCode - 6-digit OTP code
 * @returns {Promise<boolean>} - True if email sent successfully
 */
const sendPasswordResetOTPEmail = async (email, otpCode) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "InternArea | Password Reset Verification",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; background: #f3f6fb; padding: 32px 16px; color: #1f2937;">
          <div style="max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);">
            <div style="background: linear-gradient(135deg, #111827 0%, #dc2626 100%); padding: 26px 32px; color: #ffffff;">
              <div style="font-size: 12px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.85;">InternArea</div>
              <h1 style="margin: 10px 0 0; font-size: 28px; line-height: 1.3;">Password reset</h1>
            </div>
            <div style="padding: 32px;">
              <p style="margin: 0 0 16px; font-size: 16px; color: #374151; line-height: 1.7;">
                Hello,<br><br>
                We received a request to reset the password for your InternArea account. Use the verification code below to continue.
              </p>
              <div style="background: #fff7f7; border: 1px solid #fecaca; border-radius: 12px; padding: 24px; text-align: center; margin: 20px 0;">
                <div style="font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase; color: #7f1d1d; margin-bottom: 12px;">Verification code</div>
                <div style="font-size: 38px; font-weight: 700; letter-spacing: 8px; color: #b91c1c;">${otpCode}</div>
              </div>
              <p style="margin: 0; font-size: 14px; line-height: 1.7; color: #475569;">
                This code expires in 15 minutes. Please do not share it with anyone.<br>
                After verification, you will receive a temporary password by email and will be asked to update it immediately after signing in.
              </p>
            </div>
            <div style="padding: 20px 32px 28px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; color: #64748b; font-size: 12px;">
              If you did not request this reset, please ignore this email or contact support immediately.
            </div>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Password reset OTP email sent successfully to ${email}`);
    return true;
  } catch (error) {
    console.error("Error sending password reset OTP email:", error.message);
    return false;
  }
};

/**
 * Send temporary password to email
 * @param {string} email - User's email address
 * @param {string} temporaryPassword - Generated temporary password
 * @returns {Promise<boolean>} - True if email sent successfully
 */
const sendTemporaryPasswordEmail = async (email, temporaryPassword) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "InternArea | Your Temporary Password",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; background: #f3f6fb; padding: 32px 16px; color: #1f2937;">
          <div style="max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);">
            <div style="background: linear-gradient(135deg, #14532d 0%, #16a34a 100%); padding: 26px 32px; color: #ffffff;">
              <div style="font-size: 12px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.85;">InternArea</div>
              <h1 style="margin: 10px 0 0; font-size: 28px; line-height: 1.3;">Your secure temporary password</h1>
            </div>
            <div style="padding: 32px;">
              <p style="margin: 0 0 16px; font-size: 16px; color: #374151; line-height: 1.7;">
                Hello,<br><br>
                Your password has been reset successfully. Please use the temporary password below to sign in, and update it immediately after your next login.
              </p>
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 24px; text-align: center; margin: 20px 0;">
                <div style="font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase; color: #166534; margin-bottom: 12px;">Temporary password</div>
                <div style="font-size: 22px; font-weight: 700; letter-spacing: 2px; color: #14532d; word-break: break-all;">${temporaryPassword}</div>
              </div>
              <div style="background: #fff7ed; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 10px; margin: 20px 0; color: #7c2d12; font-size: 14px; line-height: 1.7;">
                <strong>Important:</strong> Change this password immediately after your next login and keep it secure.
              </div>
            </div>
            <div style="padding: 20px 32px 28px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; color: #64748b; font-size: 12px;">
              If you did not request this password reset, contact support immediately.
            </div>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Temporary password email sent successfully to ${email}`);
    return true;
  } catch (error) {
    console.error("Error sending temporary password email:", error.message);
    return false;
  }
};

/**
 * Check if user can request password reset (rate limiting: 1 per 24 hours)
 * @param {string} accountId - User account ID
 * @returns {Promise<Object>} - Rate limit status
 */
const checkPasswordResetRateLimit = async (accountId) => {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const recentRequest = await PasswordResetHistory.findOne({
    accountId,
    requestedAt: { $gte: twentyFourHoursAgo },
    verificationStatus: { $in: ["requested", "verified", "completed"] },
  }).sort({ requestedAt: -1 });

  if (recentRequest) {
    const nextAvailableTime = new Date(recentRequest.requestedAt.getTime() + 24 * 60 * 60 * 1000);
    const remainingSeconds = Math.max(0, Math.floor((nextAvailableTime - Date.now()) / 1000));
    
    return {
      canRequest: false,
      message: "You can use this option only once per day.",
      lastRequestAt: recentRequest.requestedAt,
      nextAvailableAt: nextAvailableTime,
      remainingSeconds,
    };
  }

  return {
    canRequest: true,
    message: "Password reset request allowed.",
  };
};

/**
 * Check for duplicate password reset requests (same user, same method, within 5 minutes)
 * @param {string} accountId - User account ID
 * @param {string} method - Reset method (email/sms)
 * @param {number} timeWindowSeconds - Time window (default 5 minutes)
 * @returns {Promise<boolean>} - True if duplicate detected
 */
const isDuplicatePasswordResetRequest = async (accountId, method, timeWindowSeconds = 300) => {
  const timeWindowMs = timeWindowSeconds * 1000;
  const cutoffTime = new Date(Date.now() - timeWindowMs);

  const recentRequest = await PasswordResetHistory.findOne({
    accountId,
    method,
    requestedAt: { $gte: cutoffTime },
    verificationStatus: { $in: ["requested", "verified"] },
  });

  return !!recentRequest;
};

/**
 * Get password reset history with security details
 * @param {string} accountId - User account ID
 * @param {number} limit - Max records to return
 * @returns {Promise<Array>} - Reset history
 */
const getPasswordResetHistory = async (accountId, limit = 20) => {
  try {
    const history = await PasswordResetHistory.find({ accountId })
      .select("requestedAt verifiedAt completedAt verificationStatus method ipAddress browser operatingSystem deviceType resetReason")
      .sort({ requestedAt: -1 })
      .limit(limit)
      .lean();
    
    return history;
  } catch (error) {
    console.error("Error fetching password reset history:", error.message);
    throw error;
  }
};

module.exports = {
  generateRandomPassword,
  sendPasswordResetOTPEmail,
  sendTemporaryPasswordEmail,
  checkPasswordResetRateLimit,
  isDuplicatePasswordResetRequest,
  getPasswordResetHistory,
};
