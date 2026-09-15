const nodemailer = require("nodemailer");
require("dotenv").config();

// Initialize email transporter
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

/**
 * Send OTP to user's email
 * @param {string} email - User's email address
 * @param {string} otpCode - 6-digit OTP code
 * @returns {Promise<boolean>} - True if email sent successfully
 */
const sendOTPEmail = async (email, otpCode) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "InternArea | Verify Your Email Address",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; background: #f3f6fb; padding: 32px 16px; color: #1f2937;">
          <div style="max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);">
            <div style="background: linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%); padding: 26px 32px; color: #ffffff;">
              <div style="font-size: 12px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.85;">InternArea</div>
              <h1 style="margin: 10px 0 0; font-size: 28px; line-height: 1.3;">Email verification</h1>
            </div>
            <div style="padding: 32px;">
              <p style="margin: 0 0 16px; font-size: 16px; color: #374151; line-height: 1.7;">
                Hello,<br><br>
                You are signing in to your InternArea account. For your security, please verify your email address using the code below.
              </p>
              <div style="background: #f8fafc; border: 1px solid #dbeafe; border-radius: 12px; padding: 24px; text-align: center; margin: 20px 0;">
                <div style="font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase; color: #64748b; margin-bottom: 12px;">Your verification code</div>
                <div style="font-size: 38px; font-weight: 700; letter-spacing: 8px; color: #1d4ed8;">${otpCode}</div>
              </div>
              <p style="margin: 0; font-size: 14px; line-height: 1.7; color: #475569;">
                This code expires in 10 minutes. Please do not share it with anyone.<br>
                If you did not request this verification, you can safely ignore this email.
              </p>
            </div>
            <div style="padding: 20px 32px 28px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; color: #64748b; font-size: 12px;">
              © 2026 InternArea. All rights reserved.
            </div>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`OTP email sent successfully to ${email}`);
    return true;
  } catch (error) {
    console.error("Error sending OTP email:", error.message);
    return false;
  }
};

/**
 * Generate a random 6-digit OTP
 * @returns {string} - 6-digit OTP code
 */
const generateOTP = () => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  return otp;
};

module.exports = { sendOTPEmail, generateOTP };
