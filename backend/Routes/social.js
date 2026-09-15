const express = require("express");
const Account = require("../Model/Account");
const FriendRequest = require("../Model/FriendRequest");
const Post = require("../Model/Post");
const Follow = require("../Model/Follow");
const Notification = require("../Model/Notification");
const crypto = require("crypto");

const router = express.Router();
const id = (value) => String(value || "");
const validId = (value) => /^[a-f\d]{24}$/i.test(id(value));
const quotaFor = (friends) => friends === 0 ? 0 : friends === 1 ? 1 : friends <= 5 ? 2 : friends <= 10 ? 5 : Infinity;
const tagsFrom = (text, marker) => [...new Set((String(text || "").match(new RegExp(`${marker}([A-Za-z0-9_]+)`, "g")) || []).map((tag) => tag.slice(1).toLowerCase()))];
const acceptedCount = (accountId) => FriendRequest.countDocuments({ $or: [{ requesterId: accountId }, { recipientId: accountId }], status: "accepted" });
const rateWindow = new Map();
const bannedTerms = /\b(spamword|malware|phishing|buy followers)\b/i;
const postRateLimit = Number(process.env.SOCIAL_POSTS_PER_MINUTE || 10);
const editWindowMs = Number(process.env.SOCIAL_EDIT_WINDOW_MINUTES || 15) * 60 * 1000;
const serialize = (post, viewerId) => ({ ...post.toObject(), liked: post.likes.some((value) => id(value) === viewerId), saved: post.saves.some((value) => id(value) === viewerId), likeCount: post.likes.length, saveCount: post.saves.length });
const notify = (recipientId, actorId, type, message, postId) => { if (id(recipientId) === id(actorId)) return Promise.resolve(); return Notification.create({ recipientId, actorId, type, message, postId }); };
const friendIds = async (accountId) => { const requests = await FriendRequest.find({ $or: [{ requesterId: accountId }, { recipientId: accountId }], status: "accepted" }).lean(); return requests.map((request) => id(request.requesterId) === id(accountId) ? request.recipientId : request.requesterId); };

router.get("/feed", async (req, res) => {
  const viewerId = id(req.query.accountId);
  const friends = validId(viewerId) ? await friendIds(viewerId) : [];
  const following = validId(viewerId) ? (await Follow.find({ followerId: viewerId }).select("followingId").lean()).map((item) => item.followingId) : [];
  const visibility = viewerId ? { $or: [{ privacy: "public" }, { privacy: "friends", authorId: { $in: friends } }] } : { privacy: "public" };
  const filter = req.query.hashtag ? { ...visibility, hashtags: String(req.query.hashtag).toLowerCase().replace(/^#/, "") } : visibility;
  const posts = await Post.find({ ...filter, deletedAt: { $exists: false } }).populate("authorId", "username email").sort({ createdAt: -1 }).limit(100);
  const ranked = posts.sort((left, right) => {
    const score = (post) => (friends.some((value) => id(value) === id(post.authorId?._id)) ? 100000 : 0) + (following.some((value) => id(value) === id(post.authorId?._id)) ? 50000 : 0) + post.likes.length * 3 + post.comments.length * 2 + post.shares * 2 + post.views * 0.01;
    return score(right) - score(left);
  }).slice(0, 50);
  if (ranked.length) await Post.updateMany({ _id: { $in: ranked.map((post) => post._id) } }, { $inc: { views: 1 } });
  return res.json({ success: true, posts: ranked.map((post) => serialize(post, viewerId)) });
});

router.get("/posts/history/:accountId", async (req, res) => {
  if (!validId(req.params.accountId)) return res.status(400).json({ success: false, message: "Invalid account." });
  const posts = await Post.find({ authorId: req.params.accountId }).sort({ createdAt: -1 }).limit(100);
  return res.json({ success: true, posts: posts.map((post) => serialize(post, req.params.accountId)) });
});

router.get("/quota/:accountId", async (req, res) => {
  if (!validId(req.params.accountId)) return res.status(400).json({ success: false, message: "Invalid account." });
  const friends = await acceptedCount(req.params.accountId);
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const used = await Post.countDocuments({ authorId: req.params.accountId, createdAt: { $gte: start } });
  const limit = quotaFor(friends);
  return res.json({ success: true, friends, used, limit: Number.isFinite(limit) ? limit : null, canPost: limit === Infinity || used < limit });
});

router.post("/posts", async (req, res) => {
  const authorId = id(req.body.accountId);
  if (!validId(authorId) || !(await Account.exists({ _id: authorId }))) return res.status(401).json({ success: false, message: "Sign in to create a post." });
  const text = String(req.body.text || "").trim();
  const media = Array.isArray(req.body.media) ? req.body.media.filter((item) => item && ["image", "video"].includes(item.type) && typeof item.url === "string").slice(0, 4) : [];
  if (!text && !media.length) return res.status(400).json({ success: false, message: "Add text, a photo, or a video." });
  if (text.length > 5000 || bannedTerms.test(text)) return res.status(400).json({ success: false, message: "This post cannot be published because it contains invalid or inappropriate content." });
  const now = Date.now(); const recentPosts = (rateWindow.get(authorId) || []).filter((timestamp) => now - timestamp < 60000);
  if (recentPosts.length >= postRateLimit) return res.status(429).json({ success: false, message: "You are posting too quickly. Please try again in a minute." });
  const fingerprint = crypto.createHash("sha256").update(`${authorId}:${text}:${media.map((item) => `${item.type}:${item.url}`).join("|")}`).digest("hex");
  if (await Post.exists({ authorId, fingerprint, createdAt: { $gte: new Date(now - 24 * 60 * 60 * 1000) }, deletedAt: { $exists: false } })) return res.status(409).json({ success: false, message: "You already published this post recently." });
  if (new Set(media.map((item) => item.url)).size !== media.length) return res.status(400).json({ success: false, message: "Repeated media uploads are not allowed." });
  const friends = await acceptedCount(authorId);
  const limit = quotaFor(friends);
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const used = await Post.countDocuments({ authorId, createdAt: { $gte: start } });
  if (limit === 0) return res.status(403).json({ success: false, message: "Accept a friend request before creating posts." });
  if (limit !== Infinity && used >= limit) return res.status(429).json({ success: false, message: `Your daily posting limit of ${limit} has been reached.` });
  const account = await Account.findById(authorId).lean();
  rateWindow.set(authorId, [...recentPosts, now]);
  const post = await Post.create({ authorId, authorProfile: { username: account.username, email: account.email }, friendCountAtPost: friends, text, media, privacy: req.body.privacy === "friends" ? "friends" : "public", fingerprint, hashtags: tagsFrom(text, "#"), mentions: tagsFrom(text, "@") });
  const mentioned = await Account.find({ username: { $in: post.mentions } }).select("_id").lean();
  await Promise.all(mentioned.map((person) => notify(person._id, authorId, "mention", `@${account.username || account.email} mentioned you in a post.`, post._id)));
  return res.status(201).json({ success: true, post: serialize(post, authorId) });
});

router.patch("/posts/:postId", async (req, res) => {
  const authorId = id(req.body.accountId); const post = await Post.findOne({ _id: req.params.postId, authorId, deletedAt: { $exists: false } });
  if (!post) return res.status(404).json({ success: false, message: "Post not found." });
  if (Date.now() - post.createdAt.getTime() > editWindowMs) return res.status(403).json({ success: false, message: "This post can no longer be edited." });
  const text = String(req.body.text || "").trim(); if (!text || text.length > 5000 || bannedTerms.test(text)) return res.status(400).json({ success: false, message: "Post content is invalid." });
  post.text = text; post.privacy = req.body.privacy === "friends" ? "friends" : post.privacy; post.hashtags = tagsFrom(text, "#"); post.mentions = tagsFrom(text, "@"); post.editedAt = new Date(); await post.save(); return res.json({ success: true, post: serialize(post, authorId) });
});
router.delete("/posts/:postId", async (req, res) => { const post = await Post.findOne({ _id: req.params.postId, authorId: req.body.accountId, deletedAt: { $exists: false } }); if (!post) return res.status(404).json({ success: false, message: "Post not found." }); if (Date.now() - post.createdAt.getTime() > editWindowMs) return res.status(403).json({ success: false, message: "This post can no longer be deleted." }); post.deletedAt = new Date(); await post.save(); return res.json({ success: true }); });

router.post("/posts/:postId/:action", async (req, res) => {
  const viewerId = id(req.body.accountId); const { postId, action } = req.params;
  if (!validId(viewerId) || !validId(postId)) return res.status(400).json({ success: false, message: "Invalid request." });
  const post = await Post.findById(postId); if (!post) return res.status(404).json({ success: false, message: "Post not found." });
  const actor = await Account.findById(viewerId).select("username email").lean();
  if (action === "like" || action === "save") { const field = action === "like" ? "likes" : "saves"; const index = post[field].findIndex((value) => id(value) === viewerId); index >= 0 ? post[field].splice(index, 1) : post[field].push(viewerId); if (action === "like" && index < 0) await notify(post.authorId, viewerId, "like", `@${actor?.username || actor?.email} liked your post.`, post._id); }
  else if (action === "share") { post.shares += 1; await notify(post.authorId, viewerId, "share", `@${actor?.username || actor?.email} shared your post.`, post._id); }
  else if (action === "comment") { const text = String(req.body.text || "").trim(); if (!text || text.length > 1000 || bannedTerms.test(text)) return res.status(400).json({ success: false, message: "Comment content is invalid." }); post.comments.push({ authorId: viewerId, text }); await notify(post.authorId, viewerId, "comment", `@${actor?.username || actor?.email} commented on your post.`, post._id); }
  else if (action === "report") { post.reports.push({ reporterId: viewerId, reason: String(req.body.reason || "Community report") }); }
  else return res.status(404).json({ success: false, message: "Unknown post action." });
  await post.save(); return res.json({ success: true, post: serialize(post, viewerId) });
});

router.get("/people", async (req, res) => { const accounts = await Account.find({ _id: { $ne: req.query.accountId } }).select("username email").limit(50); return res.json({ success: true, people: accounts }); });
router.post("/friends/request", async (req, res) => {
  const requesterId = id(req.body.accountId); const recipientId = id(req.body.recipientId);
  if (!validId(requesterId) || !validId(recipientId) || requesterId === recipientId) return res.status(400).json({ success: false, message: "Invalid friend request." });
  const request = await FriendRequest.findOneAndUpdate({ requesterId, recipientId }, { $setOnInsert: { requesterId, recipientId } }, { upsert: true, new: true });
  const requester = await Account.findById(requesterId).select("username email").lean();
  await notify(recipientId, requesterId, "friend_request", `@${requester?.username || requester?.email} sent you a friend request.`);
  return res.status(201).json({ success: true, request });
});
router.get("/friends/:accountId", async (req, res) => { const requests = await FriendRequest.find({ $or: [{ requesterId: req.params.accountId }, { recipientId: req.params.accountId }] }).populate("requesterId recipientId", "username email").sort({ createdAt: -1 }); return res.json({ success: true, requests }); });
router.post("/friends/:requestId/accept", async (req, res) => { const request = await FriendRequest.findOneAndUpdate({ _id: req.params.requestId, recipientId: req.body.accountId, status: "pending" }, { status: "accepted" }, { new: true }); if (!request) return res.status(404).json({ success: false, message: "Friend request not found." }); return res.json({ success: true, request }); });
router.post("/follow/:followingId", async (req, res) => { const followerId = id(req.body.accountId); const followingId = id(req.params.followingId); const existing = await Follow.findOne({ followerId, followingId }); if (existing) await existing.deleteOne(); else await Follow.create({ followerId, followingId }); return res.json({ success: true, following: !existing }); });
router.get("/notifications/:accountId", async (req, res) => { const notifications = await Notification.find({ recipientId: req.params.accountId }).populate("actorId", "username email").sort({ createdAt: -1 }).limit(50); return res.json({ success: true, notifications, unread: notifications.filter((item) => !item.readAt).length }); });
router.post("/notifications/:notificationId/read", async (req, res) => { await Notification.findOneAndUpdate({ _id: req.params.notificationId, recipientId: req.body.accountId }, { readAt: new Date() }); return res.json({ success: true }); });

module.exports = router;