const mongoose = require("mongoose");

const friendRequestSchema = new mongoose.Schema(
  {
    requesterId: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true },
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true },
    status: { type: String, enum: ["pending", "accepted", "declined"], default: "pending" },
  },
  { timestamps: true }
);

friendRequestSchema.index({ requesterId: 1, recipientId: 1 }, { unique: true });

module.exports = mongoose.model("FriendRequest", friendRequestSchema);