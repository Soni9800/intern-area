const mongoose = require("mongoose");

const otpVerificationSchema = new mongoose.Schema(
  {
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    otpCode: { type: String, required: true }, // 6-digit OTP
    attempts: { type: Number, default: 0, min: 0 },
    maxAttempts: { type: Number, default: 5 },
    isVerified: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } }, // Auto-delete after expiry
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Index for finding pending OTPs for an account
otpVerificationSchema.index({ accountId: 1, isVerified: 1 });

module.exports = mongoose.model("OTPVerification", otpVerificationSchema);
