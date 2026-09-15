const mongoose = require("mongoose");

const loginHistorySchema = new mongoose.Schema(
  {
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: "Account", default: null, index: true },
    browser: { name: String, version: String },
    operatingSystem: { name: String, version: String },
    deviceType: { type: String, enum: ["desktop", "laptop", "tablet", "mobile", "unknown"], default: "unknown" },
    deviceModel: { type: String, default: "unknown" },
    ipAddress: { type: String, default: "unknown" },
    location: { country: String, region: String, city: String },
    loggedInAt: { type: Date, default: Date.now, index: true },
    status: { type: String, enum: ["success", "failed"], required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LoginHistory", loginHistorySchema);