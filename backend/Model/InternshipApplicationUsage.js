const mongoose = require("mongoose");

const internshipApplicationUsageSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, trim: true, index: true },
    internshipId: { type: String, required: true, trim: true },
    company: { type: String, default: "" },
    status: { type: String, enum: ["paid", "pending", "rejected", "accepted"], default: "paid" },
    paymentId: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("InternshipApplicationUsage", internshipApplicationUsageSchema);
