const mongoose = require("mongoose");

const paymentHistorySchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, trim: true, index: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    planId: { type: String, required: true, default: "free" },
    planName: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    paymentId: { type: String, required: true },
    orderId: { type: String, required: true },
    signature: { type: String, default: "" },
    invoiceNumber: { type: String, required: true },
    status: { type: String, enum: ["paid", "failed", "cancelled", "pending"], default: "paid" },
    billingPeriodStart: { type: Date, required: true },
    billingPeriodEnd: { type: Date, required: true },
    billingCountry: { type: String, default: "India" },
    billingAddress: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PaymentHistory", paymentHistorySchema);
