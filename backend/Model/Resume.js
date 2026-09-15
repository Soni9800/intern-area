const mongoose = require("mongoose");

const resumeSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: true },
    isPremium: { type: Boolean, required: true },
    title: { type: String, default: "Untitled resume" },
    template: { type: String, enum: ["classic", "modern", "minimal"], default: "classic" },
    color: { type: String, default: "#2563eb" },
    font: { type: String, enum: ["Arial", "Georgia", "Trebuchet MS"], default: "Arial" },
    content: { type: mongoose.Schema.Types.Mixed, required: true },
    status: { type: String, enum: ["generated", "failed"], default: "generated" },
    isDefault: { type: Boolean, default: false },
    pdfData: { type: String, select: false },
    payment: {
      orderId: String,
      paymentId: String,
      signature: String,
      amount: { type: Number, default: 5000 },
      status: { type: String, enum: ["paid", "failed", "cancelled"], default: "paid" },
      paidAt: Date,
    },
    invoice: {
      number: String,
      issuedAt: Date,
      amount: Number,
      currency: { type: String, default: "INR" },
    },
    downloads: [{ downloadedAt: Date, ip: String }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Resume", resumeSchema);