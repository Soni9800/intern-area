const express = require("express");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const axios = require("axios");
const Account = require("../Model/Account");
const PasswordResetHistory = require("../Model/PasswordResetHistory");
require("dotenv").config();

const router = express.Router();
const pending = new Map();
const OTP_TTL_MS = 5 * 60 * 1000;
const COOLDOWN_MS = 0;
const MAX_ATTEMPTS = 5;
const MAX_RESENDS = 3;
const otpMessage = (otp) => `Your InternArea verification code is ${otp}. This code expires in 5 minutes. You have up to ${MAX_ATTEMPTS} verification attempts and ${MAX_RESENDS} resends. If you did not request this, secure your account immediately.`;

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const normalizePhone = (value) => String(value || "").replace(/[\s()-]/g, "").trim();
const hash = (value) => crypto.createHash("sha256").update(`${value}:${process.env.OTP_SECRET || "change-me"}`).digest("hex");
const metadata = (req) => ({
  ipAddress: req.ip || req.headers["x-forwarded-for"] || "unknown",
  browser: String(req.headers["user-agent"] || "unknown").slice(0, 500),
  device: /mobile|android|iphone|ipad/i.test(String(req.headers["user-agent"] || "")) ? "mobile" : "desktop",
});
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const validPhone = (value) => /^\+?[1-9]\d{7,14}$/.test(value);

const mailer = () => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE).toLowerCase() === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
};

const sendSms = async (to, body) => {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_FROM) {
    throw new Error("SMS service is not configured");
  }
  const params = new URLSearchParams({ To: to, From: process.env.TWILIO_FROM, Body: body });
  await axios.post(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, params.toString(), {
    auth: { username: process.env.TWILIO_ACCOUNT_SID, password: process.env.TWILIO_AUTH_TOKEN },
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
};

const sendCode = async (method, destination, otp) => {
  const text = otpMessage(otp);
  if (method === "sms") return sendSms(destination, text);
  const transport = mailer();
  if (!transport) throw new Error("Email service is not configured");
  return transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: destination,
    subject: "InternArea security verification code",
    text,
    html: emailTemplate("Verify your identity", `Use the verification code below to continue your password recovery.`, otp, `This code expires in 5 minutes. You have up to ${MAX_ATTEMPTS} verification attempts and ${MAX_RESENDS} resends.`),
  });
};
const sendMessage = async (method, destination, text) => {
  if (method === "sms") return sendSms(destination, text);
  const transport = mailer();
  if (!transport) throw new Error("Email service is not configured");
  return transport.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: destination, subject: "Your InternArea temporary password", text, html: emailTemplate("Your temporary password", "Use this password to sign in once, then change it immediately from your profile.", text.split(" is ")[1].split(". Sign")[0], "For your security, never share this password. If you did not request a password reset, contact support immediately.") });
};

const emailTemplate = (heading, intro, value, footer) => `<!doctype html><html><body style="margin:0;background:#f3f6fa;padding:32px 16px;font-family:Arial,sans-serif;color:#172033"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid #dce3ed;border-radius:12px;overflow:hidden"><div style="background:#10233f;padding:26px 32px"><div style="color:#7dd3fc;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase">InternArea Security</div><h1 style="margin:12px 0 0;color:#fff;font-size:25px">${heading}</h1></div><div style="padding:32px"><p style="font-size:16px;line-height:1.6">${intro}</p><div style="margin:26px 0;padding:20px;text-align:center;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;color:#1d4ed8;font-size:30px;font-weight:700;letter-spacing:5px;word-break:break-word">${value}</div><p style="font-size:14px;line-height:1.6;color:#526174">${footer}</p><p style="margin:28px 0 0;padding-top:18px;border-top:1px solid #e5e7eb;font-size:13px;color:#718096">This is an automated message from InternArea. Please do not reply.</p></div></div></body></html>`;

const generatePassword = () => {
  const consonants = "bcdfghjklmnpqrstvwxyz";
  const vowels = "aeiou";
  return Array.from({ length: 6 }, (_, index) => `${consonants[crypto.randomInt(consonants.length)]}${vowels[crypto.randomInt(vowels.length)]}`).join("");
};
const hashPassword = (password) => new Promise((resolve, reject) => {
  const salt = crypto.randomBytes(16).toString("hex");
  crypto.scrypt(password, `${process.env.PASSWORD_PEPPER || "change-me"}:${salt}`, 64, (error, derived) => {
    if (error) reject(error); else resolve(`${salt}:${derived.toString("hex")}`);
  });
});

router.post("/request", async (req, res) => {
  const method = req.body.method === "sms" ? "sms" : "email";
  const identifier = method === "sms" ? normalizePhone(req.body.identifier) : normalizeEmail(req.body.identifier);
  if ((method === "email" && !validEmail(identifier)) || (method === "sms" && !validPhone(identifier))) {
    return res.status(400).json({ success: false, message: `Enter a valid registered ${method === "sms" ? "mobile number" : "email address"}.` });
  }

  const account = await Account.findOne(method === "sms" ? { phone: identifier } : { email: identifier });
  const recent = await PasswordResetHistory.findOne({ identifier, requestedAt: { $gt: new Date(Date.now() - COOLDOWN_MS) } });
  if (recent) return res.status(429).json({ success: false, message: "You can use this option only once per day." });

  const audit = await PasswordResetHistory.create({ accountId: account?._id || null, identifier, method, ...metadata(req) });
  // Keep the response generic for unknown identifiers, but do not send a code.
  if (!account) return res.status(202).json({ success: true, message: "If the details are registered, a verification code has been sent." });

  const otp = crypto.randomInt(100000, 1000000).toString();
  pending.set(String(audit._id), { accountId: String(account._id), identifier, method, otpHash: hash(otp), expiresAt: Date.now() + OTP_TTL_MS, attempts: 0, resends: 0 });
  try {
    await sendCode(method, identifier, otp);
    return res.status(202).json({ success: true, requestId: String(audit._id), message: `If the details are registered, a verification code has been sent.` });
  } catch (error) {
    pending.delete(String(audit._id));
    await PasswordResetHistory.findByIdAndUpdate(audit._id, { verificationStatus: "failed" });
    console.error("Password reset delivery failed:", error.message);
    return res.status(503).json({ success: false, message: `${method === "sms" ? "SMS" : "Email"} service is unavailable.` });
  }
});

router.post("/verify", async (req, res) => {
  const requestId = String(req.body.requestId || "");
  const entry = pending.get(requestId);
  if (!entry || Date.now() > entry.expiresAt || entry.attempts >= MAX_ATTEMPTS) {
    if (entry) await PasswordResetHistory.findByIdAndUpdate(requestId, { verificationStatus: "failed" });
    pending.delete(requestId);
    return res.status(400).json({ success: false, message: "OTP is invalid or expired." });
  }
  const otp = String(req.body.otp || "").trim();
  entry.attempts += 1;
  if (!/^\d{6}$/.test(otp) || hash(otp) !== entry.otpHash) {
    if (entry.attempts >= MAX_ATTEMPTS) {
      pending.delete(requestId);
      await PasswordResetHistory.findByIdAndUpdate(requestId, { verificationStatus: "failed" });
    }
    return res.status(400).json({ success: false, message: "OTP is invalid or expired." });
  }
  const account = await Account.findById(entry.accountId);
  if (!account) return res.status(400).json({ success: false, message: "This password reset session is invalid or expired." });
  const temporaryPassword = generatePassword();
  try {
    await sendMessage(entry.method, entry.identifier, `Your temporary InternArea password is ${temporaryPassword}. Sign in and change it immediately.`);
    account.passwordHash = await hashPassword(temporaryPassword);
    account.mustChangePassword = true;
    await account.save();
    await PasswordResetHistory.findByIdAndUpdate(requestId, { verificationStatus: "completed", verifiedAt: new Date(), completedAt: new Date() });
    pending.delete(requestId);
  } catch (error) {
    console.error("Temporary password delivery failed:", error.message);
    return res.status(503).json({ success: false, message: "Unable to deliver the temporary password. Please try again later." });
  }
  return res.json({ success: true, message: "A temporary password was sent to your verified contact method." });
});

router.post("/complete", async (req, res) => {
  return res.status(410).json({ success: false, message: "Use the password change page after logging in with your temporary password." });
});

router.post("/resend", async (req, res) => {
  const requestId = String(req.body.requestId || "");
  const entry = pending.get(requestId);
  if (!entry || entry.resends >= MAX_RESENDS || Date.now() > entry.expiresAt) return res.status(429).json({ success: false, message: "OTP resend limit reached or the OTP has expired." });
  entry.resends += 1;
  const otp = crypto.randomInt(100000, 1000000).toString();
  entry.otpHash = hash(otp); entry.expiresAt = Date.now() + OTP_TTL_MS; entry.attempts = 0;
  try { await sendCode(entry.method, entry.identifier, otp); return res.json({ success: true, message: "A new OTP has been sent." }); }
  catch (error) { return res.status(503).json({ success: false, message: "Unable to resend OTP." }); }
});

module.exports = router;
