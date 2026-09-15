const express = require("express");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
require("dotenv").config();

const router = express.Router();
const pendingOtps = new Map();
const OTP_TTL_MS = 5 * 60 * 1000;
const REQUEST_COOLDOWN_MS = 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const hashOtp = (otp) =>
  crypto.createHash("sha256").update(`${otp}:${process.env.OTP_SECRET || "change-me"}`).digest("hex");

const getTransporter = () => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE).toLowerCase() === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
};

const requestLanguageOtp = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: "A valid registered email is required." });
  }

  const previous = pendingOtps.get(email);
  if (previous && Date.now() - previous.requestedAt < REQUEST_COOLDOWN_MS) {
    return res.status(429).json({ success: false, message: "Please wait before requesting another OTP." });
  }

  const transporter = getTransporter();
  if (!transporter) {
    return res.status(503).json({
      success: false,
      message: "Email service is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD, and OTP_SECRET.",
    });
  }

  const otp = crypto.randomInt(100000, 1000000).toString();
  const expiresAt = Date.now() + OTP_TTL_MS;
  pendingOtps.set(email, {
    hash: hashOtp(otp),
    expiresAt,
    requestedAt: Date.now(),
    attempts: 0,
  });

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: "Your language change verification code",
      text: `Hello,\n\nUse ${otp} to confirm your language change on InternArea. This code expires in 5 minutes.\n\nIf you did not request this change, you can safely ignore this email.\n\nRegards,\nInternArea Security Team`,
      html: `
        <div style="margin:0;background:#f4f7fb;padding:32px 16px;font-family:Arial,sans-serif;color:#1f2937">
          <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:32px">
            <h1 style="margin:0 0 16px;color:#2563eb;font-size:24px">Confirm your language change</h1>
            <p style="font-size:16px;line-height:1.6">Hello,</p>
            <p style="font-size:16px;line-height:1.6">Use the verification code below to confirm your language change on InternArea:</p>
            <div style="margin:24px 0;padding:18px;text-align:center;background:#eff6ff;border-radius:8px;color:#1d4ed8;font-size:32px;font-weight:700;letter-spacing:8px">${otp}</div>
            <p style="font-size:14px;line-height:1.6;color:#6b7280">This code expires in 5 minutes. If you did not request this change, you can safely ignore this email.</p>
            <p style="margin:24px 0 0;font-size:14px;color:#6b7280">Regards,<br /><strong>InternArea Security Team</strong></p>
          </div>
        </div>
      `,
    });

    return res.json({ success: true, message: "OTP sent to your registered email." });
  } catch (error) {
    pendingOtps.delete(email);
    console.error("Unable to send language OTP:", error.message);
    return res.status(502).json({ success: false, message: "Unable to send OTP email." });
  }
};

const verifyLanguageOtp = (req, res) => {
  const email = normalizeEmail(req.body.email);
  const otp = String(req.body.otp || "").trim();
  const pending = pendingOtps.get(email);

  if (!pending || Date.now() > pending.expiresAt) {
    pendingOtps.delete(email);
    return res.status(400).json({ success: false, message: "OTP is invalid or expired." });
  }

  if (!/^\d{6}$/.test(otp) || pending.attempts >= MAX_VERIFY_ATTEMPTS) {
    pending.attempts += 1;
    if (pending.attempts >= MAX_VERIFY_ATTEMPTS) pendingOtps.delete(email);
    return res.status(400).json({ success: false, message: "OTP is invalid or expired." });
  }

  if (hashOtp(otp) !== pending.hash) {
    pending.attempts += 1;
    if (pending.attempts >= MAX_VERIFY_ATTEMPTS) pendingOtps.delete(email);
    return res.status(400).json({ success: false, message: "OTP is invalid or expired." });
  }

  pendingOtps.delete(email);
  return res.json({ success: true, message: "OTP verified." });
};

router.post("/request-language-otp", requestLanguageOtp);
router.post("/verify-language-otp", verifyLanguageOtp);
// Keep the old paths working for clients that have not refreshed yet.
router.post("/request-french-otp", requestLanguageOtp);
router.post("/verify-french-otp", verifyLanguageOtp);

module.exports = router;
