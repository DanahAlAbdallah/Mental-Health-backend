import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

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
