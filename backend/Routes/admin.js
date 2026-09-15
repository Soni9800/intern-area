const express = require("express");
const crypto = require("crypto");
const Account = require("../Model/Account");
const { recordLogin } = require("../utils/loginActivity");
const router = express.Router();
const adminuser = "admin123";
const adminpass = "12345";

router.post("/resolve-email", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const adminEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();

  if (!email) {
    return res.status(400).json({ success: false, message: "A valid email is required." });
  }

  if (adminEmail && email === adminEmail) {
    await recordLogin(req, null, "success");
    return res.json({ success: true, isAdmin: true });
  }

  let account = await Account.findOne({ email });
  if (!account) {
    const baseUsername = email.split("@")[0].replace(/[^a-z0-9_]/g, "").slice(0, 18) || "member";
    let username = baseUsername;
    let suffix = 1;
    while (await Account.exists({ username })) username = `${baseUsername.slice(0, 21)}${suffix++}`;
    account = await Account.create({ email, username, passwordHash: `google:${crypto.randomBytes(32).toString("hex")}` });
  }

  await recordLogin(req, account._id, "success");
  return res.json({ success: true, isAdmin: false, account: { id: String(account._id), email: account.email, username: account.username, mustChangePassword: account.mustChangePassword } });
});

router.post("/adminlogin", (req, res) => {
  const { username, password } = req.body;
  if (username === adminuser && password === adminpass) {
  return recordLogin(req, null, "success").then(() => res.json({ success: true, message: "Admin logged in" }));
} else {
  return recordLogin(req, null, "failed").then(() => res.status(401).json({ success: false, message: "Unauthorized" }));
}

});
module.exports = router;