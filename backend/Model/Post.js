const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true },
    authorProfile: { username: String, email: String, photo: String },
    friendCountAtPost: { type: Number, required: true, default: 0 },
    text: { type: String, trim: true, maxlength: 5000, default: "" },
    media: [{ type: { type: String, enum: ["image", "video"] }, url: String }],
    privacy: { type: String, enum: ["public", "friends"], default: "public" },
    hashtags: [{ type: String, lowercase: true, trim: true }],
    mentions: [{ type: String, lowercase: true, trim: true }],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Account" }],
    saves: [{ type: mongoose.Schema.Types.ObjectId, ref: "Account" }],
    shares: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    fingerprint: { type: String, required: true },
    editedAt: Date,
    deletedAt: Date,
    comments: [{ authorId: { type: mongoose.Schema.Types.ObjectId, ref: "Account" }, text: { type: String, maxlength: 1000 }, createdAt: { type: Date, default: Date.now } }],
    reports: [{ reporterId: mongoose.Schema.Types.ObjectId, reason: String, createdAt: { type: Date, default: Date.now } }],
  },
  { timestamps: true }
);

postSchema.index({ fingerprint: 1, createdAt: -1 });
postSchema.index({ hashtags: 1, createdAt: -1 });

module.exports = mongoose.model("Post", postSchema);