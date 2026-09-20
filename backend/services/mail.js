// backend/services/mail.js
// sends email through resend (https://resend.com). without RESEND_API_KEY the email is
// printed to the console instead, so local development works without an account
const escapeHtml = (text) => String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const appUrl = () => (process.env.APP_URL || "http://localhost:5173").replace(/\/$/, "");

const layout = (title, bodyHtml) => `
<div style="font-family:Poppins,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
  <h2 style="color:#002E6E;margin:0 0 16px">Pay<span style="color:#00BAF2">TM</span></h2>
  <h3 style="margin:0 0 12px">${escapeHtml(title)}</h3>
  ${bodyHtml}
  <p style="margin-top:32px;font-size:12px;color:#64748b">If you did not expect this email you can ignore it.</p>
</div>`;

const button = (href, label) =>
    `<p><a href="${escapeHtml(href)}" style="display:inline-block;background:#002E6E;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none">${escapeHtml(label)}</a></p>`;

const sendMail = async ({ to, subject, text, html }) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        console.log(`[mail] to=${to} subject="${subject}"\n${text}\n[/mail]`);
        return;
    }

    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            "content-type": "application/json",
            authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            from: process.env.MAIL_FROM || "PayTM <onboarding@resend.dev>",
            to: [to],
            subject,
            text,
            html
        })
    });
    if (!response.ok) {
        throw new Error(`resend responded ${response.status}: ${await response.text()}`);
    }
};

// email must never break the request that triggered it
const sendMailSafe = (mail) => sendMail(mail).catch((err) => console.error("email failed", mail.subject, err.message));

const sendVerificationEmail = (user, token) => {
    const link = `${appUrl()}/verify-email?token=${token}`;
    return sendMailSafe({
        to: user.username,
        subject: "Verify your email",
        text: `Hi ${user.firstName}, confirm your email to start sending money: ${link}\nThe link expires in 24 hours.`,
        html: layout("Verify your email", `
            <p>Hi ${escapeHtml(user.firstName)}, confirm your email to start sending money.</p>
            ${button(link, "Verify email")}
            <p style="font-size:13px;color:#64748b">The link expires in 24 hours.</p>`)
    });
};

const sendPasswordResetEmail = (user, token) => {
    const link = `${appUrl()}/reset-password?token=${token}`;
    return sendMailSafe({
        to: user.username,
        subject: "Reset your password",
        text: `Hi ${user.firstName}, reset your password here: ${link}\nThe link expires in 15 minutes. If you did not ask for this, ignore this email.`,
        html: layout("Reset your password", `
            <p>Hi ${escapeHtml(user.firstName)}, we got a request to reset your password.</p>
            ${button(link, "Choose a new password")}
            <p style="font-size:13px;color:#64748b">The link expires in 15 minutes and signs you out everywhere once used.</p>`)
    });
};

module.exports = {
    sendMail,
    sendMailSafe,
    sendVerificationEmail,
    sendPasswordResetEmail,
    layout,
    button,
    escapeHtml,
    appUrl
};
