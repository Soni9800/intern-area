const express = require("express");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const Resume = require("../Model/Resume");
const PremiumMembership = require("../Model/PremiumMembership");
require("dotenv").config();

const router = express.Router();
const pending = new Map();
const PRICE = 5000;
const OTP_TTL = 5 * 60 * 1000;
const VERIFICATION_TTL = 10 * 60 * 1000;

const hash = (value) => crypto.createHash("sha256").update(`${value}:${process.env.OTP_SECRET || "change-me"}`).digest("hex");
const identity = (body) => ({ userId: String(body.userId || "").trim(), email: String(body.email || "").trim().toLowerCase() });
const isComplete = (content) => Boolean(content?.fullName?.trim() && content?.email?.trim() && content?.phone?.trim() && content?.objective?.trim());
const premiumRequired = (req, res) => {
  if (req.body.isPremium !== true) {
    res.status(403).json({ success: false, message: "Resume Builder is available to Premium users only." });
    return true;
  }
  return false;
};
const transporter = () => process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD
  ? nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: String(process.env.SMTP_SECURE).toLowerCase() === "true", auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } })
  : null;

router.get("/membership/:userId", async (req, res) => {
  const membership = await PremiumMembership.findOne({ userId: req.params.userId, status: "active" }).select("userId email status paidAt amount");
  res.json({ success: true, isPremium: Boolean(membership), membership });
});

router.post("/membership-order", async (req, res) => {
  const { userId, email } = identity(req.body);
  const verification = pending.get(`verified:${req.body.verificationToken}`);
  if (!userId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ success: false, message: "A valid registered email is required." });
  if (!verification || verification.userId !== userId || verification.email !== email || Date.now() > verification.expiresAt) return res.status(403).json({ success: false, message: "Verify the OTP before starting membership payment." });
  const existing = await PremiumMembership.findOne({ userId, status: "active" });
  if (existing) return res.status(409).json({ success: false, message: "Premium membership is already active." });
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return res.status(503).json({ success: false, message: "Razorpay is not configured on the server." });
  const Razorpay = require("razorpay");
  const order = await new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET }).orders.create({ amount: PRICE, currency: "INR", receipt: `premium_${userId}_${Date.now()}` });
  res.json({ success: true, order, keyId: process.env.RAZORPAY_KEY_ID });
});

router.post("/membership-payment", async (req, res) => {
  const { userId, email } = identity(req.body);
  const verification = pending.get(`verified:${req.body.verificationToken}`);
  if (!userId || !email) return res.status(400).json({ success: false, message: "Registered user details are required." });
  if (!verification || verification.userId !== userId || verification.email !== email || Date.now() > verification.expiresAt) return res.status(403).json({ success: false, message: "OTP verification has expired. Please verify again." });
  const signature = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "").update(`${req.body.orderId}|${req.body.paymentId}`).digest("hex");
  if (!req.body.paymentId || signature !== req.body.signature) return res.status(400).json({ success: false, message: "Membership payment verification failed." });
  const membership = await PremiumMembership.findOneAndUpdate({ userId }, { userId, email, status: "active", orderId: req.body.orderId, paymentId: req.body.paymentId, signature: req.body.signature, amount: PRICE, paidAt: new Date() }, { upsert: true, new: true });
  pending.delete(`verified:${req.body.verificationToken}`);
  res.json({ success: true, isPremium: true, membership });
});

router.get("/history/:userId", async (req, res) => {
  const resumes = await Resume.find({ userId: req.params.userId }).select("-pdfData").sort({ createdAt: -1 });
  res.json({ success: true, resumes });
});

router.post("/request-otp", async (req, res) => {
  const { userId, email } = identity(req.body);
  if (!userId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ success: false, message: "A valid registered email is required." });
  const previous = pending.get(`${userId}:${email}`);
  if (previous && Date.now() - previous.requestedAt < 60000) return res.status(429).json({ success: false, message: "Please wait before requesting another OTP." });
  const mailer = transporter();
  if (!mailer) return res.status(503).json({ success: false, message: "Email service is not configured on the server." });
  const otp = crypto.randomInt(100000, 1000000).toString();
  pending.set(`${userId}:${email}`, { hash: hash(otp), requestedAt: Date.now(), expiresAt: Date.now() + OTP_TTL, attempts: 0 });
  try {
    await mailer.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: email, subject: "Your InternArea resume verification code", text: `Your InternArea resume verification code is ${otp}. It expires in 5 minutes.` });
    res.json({ success: true, message: "OTP sent to your registered email." });
  } catch (error) {
    pending.delete(`${userId}:${email}`);
    res.status(502).json({ success: false, message: "Unable to send OTP email." });
  }
});

router.post("/verify-otp", (req, res) => {
  const { userId, email } = identity(req.body);
  const key = `${userId}:${email}`;
  const record = pending.get(key);
  if (!record || Date.now() > record.expiresAt) { pending.delete(key); return res.status(400).json({ success: false, message: "OTP is invalid or expired." }); }
  if (!/^\d{6}$/.test(String(req.body.otp || "")) || hash(String(req.body.otp)) !== record.hash || record.attempts >= 5) {
    record.attempts += 1;
    if (record.attempts >= 5) pending.delete(key);
    return res.status(400).json({ success: false, message: "OTP is invalid or expired." });
  }
  pending.delete(key);
  const verificationToken = crypto.randomBytes(24).toString("hex");
  pending.set(`verified:${verificationToken}`, { userId, email, expiresAt: Date.now() + VERIFICATION_TTL });
  res.json({ success: true, verificationToken });
});

router.post("/create-order", async (req, res) => {
  if (premiumRequired(req, res)) return;
  const { userId, email } = identity(req.body);
  const verification = pending.get(`verified:${req.body.verificationToken}`);
  if (!verification || verification.userId !== userId || verification.email !== email || Date.now() > verification.expiresAt) return res.status(403).json({ success: false, message: "Verify the OTP before starting payment." });
  if (!isComplete(req.body.content)) return res.status(400).json({ success: false, message: "Complete your name, email, phone, and career objective first." });
  const existing = await Resume.findOne({ userId, "payment.orderId": { $exists: true }, "payment.status": "paid", content: req.body.content });
  if (existing) return res.status(409).json({ success: false, message: "This resume version has already been paid for." });
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return res.status(503).json({ success: false, message: "Razorpay is not configured on the server." });
  const Razorpay = require("razorpay");
  const order = await new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET }).orders.create({ amount: PRICE, currency: "INR", receipt: `resume_${userId}_${Date.now()}` });
  res.json({ success: true, order, keyId: process.env.RAZORPAY_KEY_ID });
});

router.post("/verify-payment", async (req, res) => {
  if (premiumRequired(req, res)) return;
  const { userId, email } = identity(req.body);
  const verification = pending.get(`verified:${req.body.verificationToken}`);
  if (!verification || verification.userId !== userId || Date.now() > verification.expiresAt) return res.status(403).json({ success: false, message: "OTP verification has expired. Please verify again." });
  const signature = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "").update(`${req.body.orderId}|${req.body.paymentId}`).digest("hex");
  if (!req.body.paymentId || signature !== req.body.signature) return res.status(400).json({ success: false, message: "Payment verification failed." });
  const resume = new Resume({ userId, email, name: req.body.content.fullName, isPremium: true, title: req.body.title || `${req.body.content.fullName}'s resume`, template: req.body.template, color: req.body.color, font: req.body.font, content: req.body.content, payment: { orderId: req.body.orderId, paymentId: req.body.paymentId, signature: req.body.signature, status: "paid", paidAt: new Date() }, invoice: { number: `INV-${Date.now()}`, issuedAt: new Date(), amount: PRICE } });
  const doc = new PDFDocument({ margin: 48 });
  const chunks = []; doc.on("data", (chunk) => chunks.push(chunk));
  const pdfReady = new Promise((resolve) => doc.on("end", resolve));
  if (req.body.content.profilePhoto && /^data:image\/(png|jpe?g);base64,/.test(req.body.content.profilePhoto)) doc.image(Buffer.from(req.body.content.profilePhoto.split(",")[1], "base64"), { fit: [72, 72] });
  doc.fontSize(24).fillColor(req.body.color || "#2563eb").text(req.body.content.fullName); doc.moveDown(0.4).fontSize(10).fillColor("#333333").text(`${req.body.content.email} | ${req.body.content.phone}`); doc.moveDown().fontSize(13).fillColor(req.body.color || "#2563eb").text("CAREER OBJECTIVE"); doc.fontSize(10).fillColor("#333333").text(req.body.content.objective); ["education", "skills", "experience", "internships", "projects", "certifications", "achievements", "languages", "socialLinks", "references"].forEach((section) => { if (req.body.content[section]) { doc.moveDown().fontSize(13).fillColor(req.body.color || "#2563eb").text(section.toUpperCase()); doc.fontSize(10).fillColor("#333333").text(req.body.content[section]); } }); doc.end(); await pdfReady;
  resume.pdfData = Buffer.concat(chunks).toString("base64");
  await Resume.updateMany({ userId }, { $set: { isDefault: false } }); resume.isDefault = true; await resume.save(); pending.delete(`verified:${req.body.verificationToken}`);
  res.json({ success: true, resume: await Resume.findById(resume._id).select("-pdfData") });
});

router.get("/download/:id", async (req, res) => {
  const resume = await Resume.findById(req.params.id).select("+pdfData");
  if (!resume?.pdfData) return res.status(404).json({ success: false, message: "Resume PDF not found." });
  resume.downloads.push({ downloadedAt: new Date(), ip: req.ip }); await resume.save();
  res.setHeader("Content-Type", "application/pdf"); res.setHeader("Content-Disposition", `attachment; filename="${resume.title.replace(/[^a-z0-9]/gi, "-")}.pdf"`); res.send(Buffer.from(resume.pdfData, "base64"));
});

router.delete("/:id", async (req, res) => {
  const resume = await Resume.findOneAndDelete({ _id: req.params.id, userId: String(req.body.userId || "") });
  if (!resume) return res.status(404).json({ success: false, message: "Resume not found." });
  res.json({ success: true, message: "Resume deleted." });
});

router.patch("/:id/default", async (req, res) => { await Resume.updateMany({ userId: req.body.userId }, { $set: { isDefault: false } }); const resume = await Resume.findOneAndUpdate({ _id: req.params.id, userId: req.body.userId }, { $set: { isDefault: true } }, { new: true }).select("-pdfData"); if (!resume) return res.status(404).json({ success: false, message: "Resume not found." }); res.json({ success: true, resume }); });
module.exports = router;