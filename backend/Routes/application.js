const express = require("express");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const router = express.Router();
const application = require("../Model/Application");
const InternshipSubscription = require("../Model/InternshipSubscription");
const InternshipApplicationUsage = require("../Model/InternshipApplicationUsage");
const PaymentHistory = require("../Model/PaymentHistory");
require("dotenv").config();

const pending = new Map();
const OTP_TTL = 5 * 60 * 1000;
const VERIFICATION_TTL = 10 * 60 * 1000;

const PLAN_CONFIG = {
  free: { id: "free", name: "Free", price: 0, limit: 1, description: "1 internship application per month" },
  bronze: { id: "bronze", name: "Bronze", price: 100, limit: 3, description: "₹100/month – up to 3 applications" },
  silver: { id: "silver", name: "Silver", price: 300, limit: 5, description: "₹300/month – up to 5 applications" },
  gold: { id: "gold", name: "Gold", price: 1000, limit: Infinity, description: "₹1000/month – unlimited applications" },
};

const getPlanConfig = (planId) => PLAN_CONFIG[String(planId || "free").toLowerCase()] || PLAN_CONFIG.free;
const getPlanAmountInPaise = (planId) => Math.round((getPlanConfig(planId).price || 0) * 100);
const isPaymentWindowOpen = () => {
  const now = new Date();
  const istOffsetMinutes = 330;
  const localMinutes = (now.getTime() + istOffsetMinutes * 60 * 1000) / 60000;
  const currentMinutes = ((Math.floor(localMinutes) % (24 * 60)) + 24 * 60) % (24 * 60);
  const windowStart = 5 * 60;
  const windowEnd = 11 * 60 + 45;
  return currentMinutes >= windowStart && currentMinutes <= windowEnd;
};
const getInvoiceNumber = () => `INV-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
const sendInvoiceEmail = async ({ to, userId, email, plan, amount, paymentId, orderId, validUntil, invoiceNumber, billingDetails }) => {
  const mailer = transporter();
  if (!mailer) return;
  await mailer.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: `InternArea | Subscription Confirmation - ${plan.name}`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; background: #f3f6fb; padding: 32px 16px; color: #1f2937;">
        <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);">
          <div style="background: linear-gradient(135deg, #0f172a 0%, #2563eb 100%); padding: 26px 32px; color: #ffffff;">
            <div style="font-size: 12px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.85;">InternArea</div>
            <h1 style="margin: 10px 0 0; font-size: 28px; line-height: 1.3;">Subscription confirmed</h1>
          </div>
          <div style="padding: 32px;">
            <p style="margin: 0 0 18px; font-size: 16px; color: #374151; line-height: 1.7;">
              Thank you for subscribing to the <strong>${plan.name}</strong> plan. Your membership is now active.
            </p>
            <table style="width: 100%; border-collapse: collapse; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
              <tr><td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; width: 42%;">Invoice</td><td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #0f172a;">${invoiceNumber}</td></tr>
              <tr><td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Transaction ID</td><td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #0f172a;">${paymentId}</td></tr>
              <tr><td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Order ID</td><td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #0f172a;">${orderId}</td></tr>
              <tr><td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Plan</td><td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #0f172a;">${plan.name}</td></tr>
              <tr><td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Amount</td><td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #0f172a;">₹${amount}</td></tr>
              <tr><td style="padding: 12px 16px; color: #64748b;">Validity</td><td style="padding: 12px 16px; font-weight: 600; color: #0f172a;">${new Date().toLocaleDateString("en-IN")} to ${new Date(validUntil).toLocaleDateString("en-IN")}</td></tr>
            </table>
            <p style="margin: 18px 0 0; font-size: 14px; color: #475569; line-height: 1.7;">
              Billing details: ${billingDetails || "India"}<br>
              User: ${userId}<br>
              Email: ${email}
            </p>
          </div>
          <div style="padding: 20px 32px 28px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; color: #64748b; font-size: 12px;">
            © 2026 InternArea. All rights reserved.
          </div>
        </div>
      </div>
    `,
  });
};

const hash = (value) => crypto.createHash("sha256").update(`${value}:${process.env.OTP_SECRET || "change-me"}`).digest("hex");
const identity = (body = {}) => {
  const user = body.user || {};
  const userId = String(body.userId || user.uid || user.id || "").trim();
  const email = String(body.email || user.email || "").trim().toLowerCase();
  return { userId, email };
};
const transporter = () => process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    })
  : null;

const getActiveSubscription = async (userId) => {
  if (!userId) return null;
  return InternshipSubscription.findOne({ userId, status: "active", periodEnd: { $gt: new Date() } }).lean();
};

const getSubscriptionSummary = async (userId) => {
  const subscription = await getActiveSubscription(userId);
  if (!subscription) {
    const plan = PLAN_CONFIG.free;
    return {
      planId: plan.id,
      planName: plan.name,
      isSubscribed: false,
      limit: plan.limit,
      used: 0,
      remaining: plan.limit,
      subscription: null,
      amount: 0,
      status: "free",
    };
  }

  const limit = Number(subscription.limit || 1);
  const used = Number(subscription.used || 0);
  return {
    planId: subscription.planId || "free",
    planName: subscription.planName || "Free",
    isSubscribed: true,
    limit: Number.isFinite(limit) ? limit : Infinity,
    used,
    remaining: Number.isFinite(limit) ? Math.max(limit - used, 0) : Infinity,
    subscription,
    amount: Number(subscription.amount || 0),
    status: subscription.status,
  };
};

const resolvePlanAction = (currentPlanId, targetPlanId, requestedAction) => {
  const currentRank = { free: 0, bronze: 1, silver: 2, gold: 3 };
  const targetRank = currentRank[targetPlanId] ?? 0;
  const currentRankValue = currentRank[currentPlanId] ?? 0;

  if (requestedAction === "upgrade") return targetRank > currentRankValue ? "upgrade" : "downgrade";
  if (requestedAction === "downgrade") return "downgrade";
  if (requestedAction === "renew") return "renew";
  return targetRank >= currentRankValue ? "upgrade" : "downgrade";
};

router.get("/plans", async (req, res) => {
  res.json({ success: true, plans: Object.values(PLAN_CONFIG) });
});

router.get("/profile/:userId", async (req, res) => {
  const userId = decodeURIComponent(req.params.userId || "");
  const summary = await getSubscriptionSummary(userId);
  const invoices = await PaymentHistory.find({ userId }).sort({ createdAt: -1 }).lean();
  res.json({
    success: true,
    subscription: summary,
    currentPlan: summary.planName,
    remainingQuota: summary.remaining,
    renewalDate: summary.subscription?.periodEnd || new Date(),
    invoices,
    paymentHistory: invoices,
  });
});

router.get("/subscription/:userId", async (req, res) => {
  const userId = decodeURIComponent(req.params.userId || "");
  const summary = await getSubscriptionSummary(userId);
  res.json({ success: true, ...summary });
});

router.post("/request-otp", async (req, res) => {
  const { userId, email } = identity(req.body);
  if (!userId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: "A valid registered email is required." });
  }

  const previous = pending.get(`${userId}:${email}`);
  if (previous && Date.now() - previous.requestedAt < 60000) {
    return res.status(429).json({ success: false, message: "Please wait before requesting another OTP." });
  }

  const mailer = transporter();
  if (!mailer) {
    return res.status(503).json({ success: false, message: "Email service is not configured on the server." });
  }

  const otp = crypto.randomInt(100000, 1000000).toString();
  pending.set(`${userId}:${email}`, {
    hash: hash(otp),
    requestedAt: Date.now(),
    expiresAt: Date.now() + OTP_TTL,
    attempts: 0,
  });

  try {
    await mailer.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: "InternArea | Plan Verification Code",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; background: #f3f6fb; padding: 32px 16px; color: #1f2937;">
          <div style="max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);">
            <div style="background: linear-gradient(135deg, #0f172a 0%, #2563eb 100%); padding: 26px 32px; color: #ffffff;">
              <div style="font-size: 12px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.85;">InternArea</div>
              <h1 style="margin: 10px 0 0; font-size: 28px; line-height: 1.3;">Verify your purchase</h1>
            </div>
            <div style="padding: 32px;">
              <p style="margin: 0 0 16px; font-size: 16px; color: #374151; line-height: 1.7;">
                Hello,<br><br>
                Use the verification code below to confirm your internship plan purchase.
              </p>
              <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 24px; text-align: center; margin: 20px 0;">
                <div style="font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase; color: #1d4ed8; margin-bottom: 12px;">Verification code</div>
                <div style="font-size: 38px; font-weight: 700; letter-spacing: 8px; color: #1d4ed8;">${otp}</div>
              </div>
              <p style="margin: 0; font-size: 14px; line-height: 1.7; color: #475569;">
                This code expires in 5 minutes. Please do not share it with anyone.
              </p>
            </div>
            <div style="padding: 20px 32px 28px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; color: #64748b; font-size: 12px;">
              © 2026 InternArea. All rights reserved.
            </div>
          </div>
        </div>
      `,
    });
    return res.json({ success: true, message: "OTP sent to your registered email." });
  } catch (error) {
    pending.delete(`${userId}:${email}`);
    return res.status(502).json({ success: false, message: "Unable to send OTP email." });
  }
});

router.post("/verify-otp", (req, res) => {
  const { userId, email } = identity(req.body);
  const key = `${userId}:${email}`;
  const record = pending.get(key);

  if (!record || Date.now() > record.expiresAt) {
    pending.delete(key);
    return res.status(400).json({ success: false, message: "OTP is invalid or expired." });
  }

  if (!/^\d{6}$/.test(String(req.body.otp || "")) || hash(String(req.body.otp)) !== record.hash || record.attempts >= 5) {
    record.attempts += 1;
    if (record.attempts >= 5) pending.delete(key);
    return res.status(400).json({ success: false, message: "OTP is invalid or expired." });
  }

  pending.delete(key);
  const verificationToken = crypto.randomBytes(24).toString("hex");
  pending.set(`verified:${verificationToken}`, { userId, email, expiresAt: Date.now() + VERIFICATION_TTL });
  return res.json({ success: true, verificationToken });
});

router.post("/create-order", async (req, res) => {
  const { userId, email } = identity(req.body);
  const plan = getPlanConfig(req.body.planId || "free");
  const verification = pending.get(`verified:${req.body.verificationToken}`);

  if (!userId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: "A valid registered email is required." });
  }

  if (!verification || verification.userId !== userId || verification.email !== email || Date.now() > verification.expiresAt) {
    return res.status(403).json({ success: false, message: "Verify the OTP before starting payment." });
  }

  if (!isPaymentWindowOpen()) {
    return res.status(403).json({ success: false, message: "Payments are allowed only between 5:00 AM and 11:45 AM IST." });
  }

  if (plan.price <= 0) {
    return res.status(400).json({ success: false, message: "Free plan does not require payment." });
  }

  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return res.status(503).json({ success: false, message: "Razorpay is not configured on the server." });
  }

  const existingPayment = await PaymentHistory.findOne({ userId, orderId: req.body.orderId || "", status: { $in: ["paid", "pending"] } }).lean();
  if (existingPayment) {
    return res.status(409).json({ success: false, message: "This payment request already exists." });
  }

  const Razorpay = require("razorpay");
  const amount = getPlanAmountInPaise(plan.id);
  const order = await new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  }).orders.create({
    amount,
    currency: "INR",
    receipt: `internship-plan_${plan.id}_${userId}_${Date.now()}`,
  });

  return res.json({ success: true, order, keyId: process.env.RAZORPAY_KEY_ID, plan: { ...plan, amount: plan.price } });
});

router.post("/record-payment-status", async (req, res) => {
  const { userId, email } = identity(req.body);
  const status = String(req.body.status || "failed").toLowerCase();
  if (!userId || !email) return res.status(400).json({ success: false, message: "User details are required." });

  const record = await PaymentHistory.findOne({ userId, orderId: req.body.orderId || "", paymentId: req.body.paymentId || "" });
  if (record) return res.json({ success: true, record });

  await PaymentHistory.create({
    userId,
    email,
    planId: req.body.planId || "free",
    planName: req.body.planName || "Internship Plan",
    amount: Number(req.body.amount || 0),
    currency: "INR",
    paymentId: req.body.paymentId || `failed-${Date.now()}`,
    orderId: req.body.orderId || `order-${Date.now()}`,
    signature: req.body.signature || "",
    invoiceNumber: getInvoiceNumber(),
    status,
    billingPeriodStart: new Date(),
    billingPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    billingCountry: "India",
    billingAddress: req.body.billingAddress || "",
  });

  return res.json({ success: true, status });
});

router.post("/verify-payment", async (req, res) => {
  const { userId, email } = identity(req.body);
  const plan = getPlanConfig(req.body.planId || "free");
  const verification = pending.get(`verified:${req.body.verificationToken}`);

  if (!verification || verification.userId !== userId || verification.email !== email || Date.now() > verification.expiresAt) {
    return res.status(403).json({ success: false, message: "OTP verification has expired. Please verify again." });
  }

  if (!isPaymentWindowOpen()) {
    return res.status(403).json({ success: false, message: "Payments are allowed only between 5:00 AM and 11:45 AM IST." });
  }

  const duplicate = await PaymentHistory.findOne({ userId, paymentId: req.body.paymentId || "", status: "paid" }).lean();
  if (duplicate) {
    return res.status(409).json({ success: false, message: "Duplicate payment detected. This transaction has already been processed." });
  }

  const signature = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
    .update(`${req.body.orderId}|${req.body.paymentId}`)
    .digest("hex");

  if (!req.body.paymentId || signature !== req.body.signature) {
    await PaymentHistory.create({
      userId,
      email,
      planId: plan.id,
      planName: plan.name,
      amount: Number(req.body.amount || plan.price),
      currency: "INR",
      paymentId: req.body.paymentId || `failed-${Date.now()}`,
      orderId: req.body.orderId || `order-${Date.now()}`,
      signature: req.body.signature || "",
      invoiceNumber: getInvoiceNumber(),
      status: "failed",
      billingPeriodStart: new Date(),
      billingPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      billingCountry: "India",
      billingAddress: req.body.billingAddress || "",
    });
    return res.status(400).json({ success: false, message: "Payment verification failed." });
  }

  const action = String(req.body.action || "purchase").toLowerCase();
  const existing = await getActiveSubscription(userId);
  const now = new Date();
  const nextPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const subscriptionData = {
    userId,
    email,
    planId: plan.id,
    planName: plan.name,
    status: "active",
    amount: plan.price,
    currency: "INR",
    limit: plan.limit,
    used: 0,
    periodStart: now,
    periodEnd: nextPeriodEnd,
    orderId: req.body.orderId,
    paymentId: req.body.paymentId,
    signature: req.body.signature,
  };

  const subscription = existing
    ? await InternshipSubscription.findByIdAndUpdate(existing._id, {
        ...subscriptionData,
        used: resolvePlanAction(existing.planId, plan.id, action) === "downgrade" ? Math.min(existing.used || 0, plan.limit) : 0,
      }, { new: true })
    : await InternshipSubscription.create(subscriptionData);

  const invoiceNumber = getInvoiceNumber();
  await PaymentHistory.findOneAndUpdate(
    { userId, paymentId: req.body.paymentId },
    {
      userId,
      email,
      planId: plan.id,
      planName: plan.name,
      amount: plan.price,
      currency: "INR",
      paymentId: req.body.paymentId,
      orderId: req.body.orderId,
      signature: req.body.signature,
      invoiceNumber,
      status: "paid",
      billingPeriodStart: now,
      billingPeriodEnd: nextPeriodEnd,
      billingCountry: "India",
      billingAddress: req.body.billingAddress || "",
    },
    { upsert: true, new: true }
  );

  await sendInvoiceEmail({
    to: email,
    userId,
    email,
    plan,
    amount: plan.price,
    paymentId: req.body.paymentId,
    orderId: req.body.orderId,
    validUntil: nextPeriodEnd,
    invoiceNumber,
    billingDetails: `India • ${email}`,
  });

  pending.delete(`verified:${req.body.verificationToken}`);
  return res.json({ success: true, isSubscribed: true, subscription, plan: plan.id, action, invoiceNumber });
});

router.post("/plan-change", async (req, res) => {
  const { userId, email, planId } = identity(req.body);
  const chosenPlan = getPlanConfig(planId);
  const current = await getActiveSubscription(userId);

  if (!userId || !email) {
    return res.status(400).json({ success: false, message: "User details are required." });
  }

  if (!chosenPlan || chosenPlan.price <= 0) {
    if (current) {
      await InternshipSubscription.findByIdAndUpdate(current._id, { status: "cancelled", periodEnd: new Date() });
    }
    return res.json({ success: true, status: "cancelled", planId: "free" });
  }

  if (!current) {
    return res.status(403).json({ success: false, message: "Purchase a plan before changing it." });
  }

  const action = resolvePlanAction(current.planId, chosenPlan.id, req.body.action || "upgrade");
  const updated = await InternshipSubscription.findByIdAndUpdate(current._id, {
    planId: chosenPlan.id,
    planName: chosenPlan.name,
    amount: chosenPlan.price,
    limit: chosenPlan.limit,
    status: "active",
    periodStart: new Date(),
    periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    used: action === "downgrade" ? Math.min(current.used || 0, chosenPlan.limit) : 0,
  }, { new: true });

  return res.json({ success: true, updated, action, planId: chosenPlan.id });
});

router.post("/cancel-subscription", async (req, res) => {
  const { userId, email } = identity(req.body);
  const active = await InternshipSubscription.findOne({ userId, status: "active" });
  if (!active) {
    return res.status(404).json({ success: false, message: "No active subscription found." });
  }

  const cancelled = await InternshipSubscription.findByIdAndUpdate(active._id, {
    status: "cancelled",
    periodEnd: new Date(),
    planId: "free",
    planName: "Free",
    limit: 1,
    used: 0,
  }, { new: true });

  await PaymentHistory.create({
    userId,
    email,
    planId: "free",
    planName: "Free",
    amount: 0,
    currency: "INR",
    paymentId: `cancelled-${Date.now()}`,
    orderId: `cancelled-order-${Date.now()}`,
    signature: "",
    invoiceNumber: getInvoiceNumber(),
    status: "cancelled",
    billingPeriodStart: new Date(active.periodStart || Date.now()),
    billingPeriodEnd: new Date(),
    billingCountry: "India",
    billingAddress: "",
  });

  return res.json({ success: true, subscription: cancelled, planId: "free" });
});

router.post("/renew-subscription", async (req, res) => {
  const { userId, email } = identity(req.body);
  const current = await getActiveSubscription(userId);

  if (!current) {
    return res.status(404).json({ success: false, message: "No active subscription to renew." });
  }

  const activePlan = getPlanConfig(current.planId || "free");
  const renewed = await InternshipSubscription.findByIdAndUpdate(current._id, {
    amount: activePlan.price,
    limit: activePlan.limit,
    status: "active",
    periodStart: new Date(),
    periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    used: 0,
  }, { new: true });

  return res.json({ success: true, subscription: renewed, planId: activePlan.id });
});

router.post("/", async (req, res) => {
  const { userId, email } = identity(req.body);
  const summary = await getSubscriptionSummary(userId);

  if (summary.remaining <= 0) {
    return res.status(403).json({
      success: false,
      message: "Your internship application limit has been exhausted for this billing cycle.",
    });
  }

  const applicationData = new application({
    company: req.body.company,
    category: req.body.category,
    coverLetter: req.body.coverLetter,
    user: req.body.user,
    Application: req.body.Application,
    body: req.body.body,
    availability: req.body.availability,
    email,
    userId,
  });

  try {
    const savedApplication = await applicationData.save();
    if (summary.subscription) {
      await InternshipSubscription.findByIdAndUpdate(summary.subscription._id, { $inc: { used: 1 }, updatedAt: new Date() });
    }
    await InternshipApplicationUsage.create({
      userId,
      internshipId: String(req.body.Application || ""),
      company: req.body.company || "",
      status: "paid",
      paymentId: summary.subscription?.paymentId || "",
    });

    const refreshed = await getSubscriptionSummary(userId);
    return res.status(201).json({ success: true, application: savedApplication, remaining: refreshed.remaining });
  } catch (error) {
    console.log(error);
    return res.status(400).json({ message: "Failed to submit internship application", error: error.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const data = await application.find();
    res.json(data).status(200);
  } catch (error) {
    console.log(error);
    res.status(404).json({ error: "internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const data = await application.findById(id);
    if (!data) {
      return res.status(404).json({ error: "application not found" });
    }
    return res.json(data).status(200);
  } catch (error) {
    console.log(error);
    return res.status(404).json({ error: "internal server error" });
  }
});

router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { action } = req.body;
  let status;

  if (action === "accepted") {
    status = "accepted";
  } else if (action === "rejected") {
    status = "rejected";
  } else {
    return res.status(404).json({ error: "Invalid action" });
  }

  try {
    const updateapplication = await application.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true }
    );
    if (!updateapplication) {
      return res.status(404).json({ error: "Not able to update the application" });
    }
    return res.status(200).json({ sucess: true, data: updateapplication });
  } catch (error) {
    return res.status(500).json({ error: "internal server error" });
  }
});

module.exports = router;