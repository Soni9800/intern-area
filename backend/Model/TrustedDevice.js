const mongoose = require("mongoose");

const trustedDeviceSchema = new mongoose.Schema(
  {
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true, index: true },
    deviceFingerprint: { type: String, required: true, unique: true, sparse: true },
    deviceName: { type: String }, // User-friendly name like "My Chrome", "iPhone 12"
    browser: { name: String, version: String },
    operatingSystem: { name: String, version: String },
    deviceType: { type: String, enum: ["desktop", "laptop", "tablet", "mobile", "unknown"], default: "unknown" },
    deviceModel: { type: String, default: "unknown" },
    ipAddress: { type: String, default: "unknown" },
    location: { country: String, region: String, city: String },
    isTrusted: { type: Boolean, default: false },
    trustedAt: { type: Date },
    lastUsedAt: { type: Date, default: Date.now, index: true },
    lastVerifiedAt: { type: Date },
    verificationCount: { type: Number, default: 0 }, // Number of times verified on this device
    isActive: { type: Boolean, default: true }, // Can be deactivated by user
    notes: { type: String }, // User-added notes
  },
  { timestamps: true }
);

// Index for finding trusted devices by account
trustedDeviceSchema.index({ accountId: 1, isTrusted: 1 });
trustedDeviceSchema.index({ accountId: 1, isActive: 1 });

module.exports = mongoose.model("TrustedDevice", trustedDeviceSchema);
