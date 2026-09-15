const mongoose = require("mongoose");

const loginAttemptSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: "Account", default: null, index: true },
    ipAddress: { type: String, required: true, index: true },
    browser: { name: String, version: String },
    operatingSystem: { name: String, version: String },
    deviceType: { type: String, enum: ["desktop", "laptop", "tablet", "mobile", "unknown"], default: "unknown" },
    deviceModel: { type: String, default: "unknown" },
    location: { country: String, region: String, city: String },
    attemptType: { type: String, enum: ["password", "otp", "otp-resend"], default: "password" },
    status: { type: String, enum: ["success", "failed"], required: true },
    failureReason: { 
      type: String, 
      enum: [
        "invalid-credentials",
        "invalid-otp",
        "otp-expired",
        "max-attempts-exceeded",
        "account-locked",
        "mobile-time-restriction",
        "network-error",
        null
      ], 
      default: null 
    },
    attemptedAt: { type: Date, default: Date.now, index: true },
    requestId: { type: String, unique: true, sparse: true }, // For tracking duplicate requests
  },
  { timestamps: true }
);

// TTL index: Keep failed attempts for 24 hours, then auto-delete
loginAttemptSchema.index({ attemptedAt: 1 }, { expireAfterSeconds: 86400 });

// Index for rate limiting checks
loginAttemptSchema.index({ email: 1, attemptedAt: -1 });
loginAttemptSchema.index({ ipAddress: 1, attemptedAt: -1 });
loginAttemptSchema.index({ accountId: 1, attemptedAt: -1 });

module.exports = mongoose.model("LoginAttempt", loginAttemptSchema);
