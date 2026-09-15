const mongoose = require("mongoose");

const passwordResetHistorySchema = new mongoose.Schema(
  {
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true, index: true },
    email: { type: String, lowercase: true, trim: true },
    phoneNumber: { type: String, trim: true },
    identifier: { type: String, required: true }, // Email or phone used
    method: { type: String, enum: ["email", "sms"], required: true },
    requestedAt: { type: Date, default: Date.now, index: true },
    verifiedAt: Date,
    completedAt: Date,
    expiresAt: { type: Date }, // Request expiry (24 hours)
    verificationStatus: {
      type: String,
      enum: ["requested", "verified", "completed", "expired", "failed", "cancelled"],
      default: "requested",
    },
    ipAddress: { type: String, default: "unknown" },
    location: { country: String, region: String, city: String },
    browser: { name: String, version: String },
    operatingSystem: { name: String, version: String },
    deviceType: { type: String, enum: ["desktop", "laptop", "tablet", "mobile", "unknown"], default: "unknown" },
    deviceModel: { type: String },
    resetReason: { type: String, enum: ["user-requested", "account-recovery", "suspicious-activity"], default: "user-requested" },
    otpAttempts: { type: Number, default: 0 },
    maxOTPAttempts: { type: Number, default: 5 },
    temporaryPasswordGenerated: { type: Boolean, default: false },
    temporaryPasswordExpired: { type: Boolean, default: false }, // After first login
  },
  { timestamps: true }
);

// TTL index: Auto-delete old reset records after 30 days
passwordResetHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });
// Index for rate limiting checks
passwordResetHistorySchema.index({ accountId: 1, requestedAt: -1 });

module.exports = mongoose.model("PasswordResetHistory", passwordResetHistorySchema);
