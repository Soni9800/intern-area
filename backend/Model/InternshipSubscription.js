const mongoose = require("mongoose");

const internshipSubscriptionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, trim: true, index: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    planId: { type: String, default: "free" },
    planName: { type: String, default: "Internship Application Pass" },
    status: { type: String, enum: ["active", "expired", "cancelled"], default: "active" },
    amount: { type: Number, default: 199 },
    currency: { type: String, default: "INR" },
    limit: { type: Number, default: 5 },
    used: { type: Number, default: 0 },
    periodStart: { type: Date, required: true, default: Date.now },
    periodEnd: { type: Date, required: true },
    orderId: { type: String, default: "" },
    paymentId: { type: String, default: "" },
    signature: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

internshipSubscriptionSchema.pre("save", function preSave(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model("InternshipSubscription", internshipSubscriptionSchema);
