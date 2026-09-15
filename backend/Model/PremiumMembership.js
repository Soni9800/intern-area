const mongoose = require("mongoose");

const premiumMembershipSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    status: { type: String, enum: ["active", "failed", "cancelled"], default: "active" },
    orderId: { type: String, required: true },
    paymentId: { type: String, required: true },
    signature: { type: String, required: true },
    amount: { type: Number, default: 5000 },
    paidAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PremiumMembership", premiumMembershipSchema);