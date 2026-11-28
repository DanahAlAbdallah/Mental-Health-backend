import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// FUNCTION FOR RESSETING PASSWORD
export async function sendPasswordResetEmail(email: string, token: string) {
  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

  // During initial testing or on Resend's free tier without a custom domain,
  // you must use "onboarding@resend.dev" as the sender.
  const fromEmail =
    process.env.NODE_ENV === "production"
      ? "support@yourdomain.com"
      : "onboarding@resend.dev";

  try {
    const data = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: "Reset Your Password",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; border-radius: 8px;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p style="color: #555; font-size: 16px;">
            You requested a password reset for your account. Click the button below to choose a new password. This link expires in 30 minutes.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="color: #777; font-size: 14px;">
            If you didn't request this, you can safely ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
          <p style="color: #999; font-size: 12px;">Button not working? Copy and paste this link into your browser:</p>
          <p style="color: #999; font-size: 12px; word-break: break-all;">${resetLink}</p>
        </div>
      `,
    });

    console.log("Password reset email sent successfully:", data);
  } catch (error) {
    console.error("Failed to send password reset email via Resend:", error);
    throw new Error("Failed to send email");
  }
}

// FUNCTION FOR VERIFYING ACCOUNT
export async function sendVerificationEmail(email: string, token: string,returnTo: string) {
  const verificationLink =
  `${process.env.FRONTEND_URL}/verify-email?token=${token}&returnTo=${encodeURIComponent(returnTo)}`;

  const fromEmail =
    process.env.NODE_ENV === "production"
      ? "onboarding@resend.dev"
      : "onboarding@resend.dev";

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: "Verify Your Athar Account",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
          <h2>Welcome to Athar!</h2>

          <p>Thank you for creating an account.</p>

          <p>Please verify your email address by clicking the button below:</p>

          <a
            href="${verificationLink}"
            style="
              display: inline-block;
              padding: 12px 24px;
              background-color: #526B5B;
              color: white;
              text-decoration: none;
              border-radius: 6px;
            "
          >
            Verify My Email
          </a>

          <p>This link expires in 24 hours.</p>

          <p>If you didn't create an account, you can ignore this email.</p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend verification email error:", error);
      throw new Error("Failed to send verification email");
    }

    console.log("Verification email sent successfully:", data);
  } catch (error) {
    console.error("Failed to send verification email:", error);
    throw new Error("Failed to send verification email");
  }
}
