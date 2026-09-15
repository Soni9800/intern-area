const mongoose = require("mongoose");

const accountSchema = new mongoose.Schema(
  {
    username: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
    email: { type: String, lowercase: true, trim: true, sparse: true, unique: true },
    phone: { type: String, trim: true, sparse: true, unique: true },
    passwordHash: { type: String, required: true },
    mustChangePassword: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Account", accountSchema);
