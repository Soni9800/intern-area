const LoginAttempt = require("../Model/LoginAttempt");

/**
 * Check if an account/IP has exceeded login attempt rate limits
 * @param {string} email - User email
 * @param {string} ipAddress - Client IP address
 * @param {string} timeWindowSeconds - Time window to check (default 15 minutes)
 * @returns {Object} - Rate limit status
 */
const checkRateLimit = async (email, ipAddress, timeWindowSeconds = 900) => {
  const timeWindowMs = timeWindowSeconds * 1000;
  const cutoffTime = new Date(Date.now() - timeWindowMs);

  // Check failed attempts by email
  const emailFailedAttempts = await LoginAttempt.countDocuments({
    email,
    status: "failed",
    attemptedAt: { $gte: cutoffTime },
  });

  // Check failed attempts by IP
  const ipFailedAttempts = await LoginAttempt.countDocuments({
    ipAddress,
    status: "failed",
    attemptedAt: { $gte: cutoffTime },
  });

  const emailLimit = 5; // Max 5 failed attempts per email in time window
  const ipLimit = 10; // Max 10 failed attempts per IP in time window

  return {
    emailFailedAttempts,
    ipFailedAttempts,
    isEmailRateLimited: emailFailedAttempts >= emailLimit,
    isIPRateLimited: ipFailedAttempts >= ipLimit,
    emailAttemptsRemaining: Math.max(0, emailLimit - emailFailedAttempts),
    ipAttemptsRemaining: Math.max(0, ipLimit - ipFailedAttempts),
    timeWindowSeconds,
  };
};

/**
 * Record a login attempt
 * @param {Object} data - Attempt data
 * @returns {Promise<Object>} - Created attempt record
 */
const recordLoginAttempt = async (data) => {
  try {
    const attempt = await LoginAttempt.create({
      email: data.email,
      accountId: data.accountId || null,
      ipAddress: data.ipAddress,
      browser: data.browser,
      operatingSystem: data.operatingSystem,
      deviceType: data.deviceType,
      deviceModel: data.deviceModel,
      attemptType: data.attemptType || "password",
      status: data.status,
      failureReason: data.failureReason || null,
      requestId: data.requestId,
    });
    return attempt;
  } catch (error) {
    console.error("Error recording login attempt:", error.message);
    throw error;
  }
};

/**
 * Check for duplicate/concurrent login requests
 * @param {string} accountId - User account ID
 * @param {string} deviceFingerprint - Device fingerprint
 * @param {number} timeWindowSeconds - Time window (default 30 seconds)
 * @returns {Promise<boolean>} - True if duplicate detected
 */
const isDuplicateLoginRequest = async (accountId, deviceFingerprint, timeWindowSeconds = 30) => {
  const timeWindowMs = timeWindowSeconds * 1000;
  const cutoffTime = new Date(Date.now() - timeWindowMs);

  const recentAttempts = await LoginAttempt.countDocuments({
    accountId,
    attemptType: "password",
    attemptedAt: { $gte: cutoffTime },
  });

  // If more than 1 attempt in time window from same device, consider it duplicate
  return recentAttempts > 0;
};

/**
 * Get recent failed OTP verification attempts for an OTP record
 * @param {string} accountId - User account ID
 * @param {number} timeWindowSeconds - Time window (default 30 minutes)
 * @returns {Promise<number>} - Count of failed OTP attempts
 */
const getRecentOTPFailures = async (accountId, timeWindowSeconds = 1800) => {
  const timeWindowMs = timeWindowSeconds * 1000;
  const cutoffTime = new Date(Date.now() - timeWindowMs);

  const failedAttempts = await LoginAttempt.countDocuments({
    accountId,
    attemptType: "otp",
    status: "failed",
    attemptedAt: { $gte: cutoffTime },
  });

  return failedAttempts;
};

/**
 * Get OTP resend request count in time window
 * @param {string} accountId - User account ID
 * @param {number} timeWindowSeconds - Time window (default 10 minutes)
 * @returns {Promise<number>} - Count of OTP resend requests
 */
const getOTPResendCount = async (accountId, timeWindowSeconds = 600) => {
  const timeWindowMs = timeWindowSeconds * 1000;
  const cutoffTime = new Date(Date.now() - timeWindowMs);

  const resendCount = await LoginAttempt.countDocuments({
    accountId,
    attemptType: "otp-resend",
    attemptedAt: { $gte: cutoffTime },
  });

  return resendCount;
};

/**
 * Check if account is in lockout status due to suspicious activity
 * @param {string} accountId - User account ID
 * @returns {Promise<Object>} - Lockout status
 */
const checkAccountLockout = async (accountId, maxFailuresInWindow = 10, timeWindowSeconds = 3600) => {
  const timeWindowMs = timeWindowSeconds * 1000;
  const cutoffTime = new Date(Date.now() - timeWindowMs);

  const failedAttempts = await LoginAttempt.countDocuments({
    accountId,
    status: "failed",
    attemptedAt: { $gte: cutoffTime },
  });

  return {
    isLockedOut: failedAttempts >= maxFailuresInWindow,
    failedAttemptCount: failedAttempts,
    maxFailuresAllowed: maxFailuresInWindow,
    timeWindowSeconds,
  };
};

/**
 * Clear old login attempts for cleanup
 * @param {number} daysOld - Delete attempts older than this many days
 * @returns {Promise<Object>} - Deletion result
 */
const clearOldLoginAttempts = async (daysOld = 30) => {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  
  const result = await LoginAttempt.deleteMany({
    attemptedAt: { $lt: cutoffDate },
  });

  return {
    deletedCount: result.deletedCount,
    cutoffDate,
  };
};

module.exports = {
  checkRateLimit,
  recordLoginAttempt,
  isDuplicateLoginRequest,
  getRecentOTPFailures,
  getOTPResendCount,
  checkAccountLockout,
  clearOldLoginAttempts,
};
