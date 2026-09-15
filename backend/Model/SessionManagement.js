const mongoose = require("mongoose");

const sessionManagementSchema = new mongoose.Schema(
  {
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true, index: true },
    sessionToken: { type: String, required: true, unique: true, index: true }, // JWT or session token
    deviceFingerprint: { type: String, required: true },
    browser: { name: String, version: String },
    operatingSystem: { name: String, version: String },
    deviceType: { type: String, enum: ["desktop", "laptop", "tablet", "mobile", "unknown"], default: "unknown" },
    deviceModel: { type: String, default: "unknown" },
    ipAddress: { type: String, default: "unknown" },
    location: { country: String, region: String, city: String },
    loginAt: { type: Date, default: Date.now, index: true },
    lastActivityAt: { type: Date, default: Date.now, index: true },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } }, // Auto-delete expired sessions
    isActive: { type: Boolean, default: true, index: true },
    logoutAt: { type: Date },
    logoutReason: { type: String, enum: ["user-logout", "timeout", "security-issue", "device-untrustworthy", "admin-action", null], default: null },
    isFirstTimeLogin: { type: Boolean, default: false }, // First login from this device
    requiresVerification: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    otpVerificationId: { type: mongoose.Schema.Types.ObjectId, ref: "OTPVerification" },
  },
  { timestamps: true }
);

// Index for finding active sessions
sessionManagementSchema.index({ accountId: 1, isActive: 1 });
sessionManagementSchema.index({ accountId: 1, loginAt: -1 });

module.exports = mongoose.model("SessionManagement", sessionManagementSchema);
