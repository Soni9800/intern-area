const mongoose = require("mongoose");

const passwordResetOTPSchema = new mongoose.Schema(
  {
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true, index: true },
    email: { type: String, lowercase: true, trim: true },
    phoneNumber: { type: String, trim: true },
    otpCode: { type: String, required: true }, // 6-digit OTP
    method: { type: String, enum: ["email", "sms"], required: true },
    attempts: { type: Number, default: 0, min: 0 },
    maxAttempts: { type: Number, default: 5 },
    isVerified: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } }, // Auto-delete after expiry
    createdAt: { type: Date, default: Date.now },
    requestId: { type: String, unique: true, sparse: true }, // Link to PasswordResetHistory
  },
  { timestamps: true }
);

// Index for finding pending OTPs for an account
passwordResetOTPSchema.index({ accountId: 1, isVerified: 1 });

module.exports = mongoose.model("PasswordResetOTP", passwordResetOTPSchema);
