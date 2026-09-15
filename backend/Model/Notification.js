const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "Account" },
    type: { type: String, enum: ["like", "comment", "share", "friend_request", "mention"], required: true },
    postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post" },
    message: { type: String, required: true, maxlength: 240 },
    readAt: Date,
  },
  { timestamps: true }
);

notificationSchema.index({ recipientId: 1, createdAt: -1 });
module.exports = mongoose.model("Notification", notificationSchema);