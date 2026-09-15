const mongoose = require("mongoose");

const followSchema = new mongoose.Schema(
  { followerId: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true }, followingId: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true } },
  { timestamps: true }
);

followSchema.index({ followerId: 1, followingId: 1 }, { unique: true });
module.exports = mongoose.model("Follow", followSchema);