import sgMail from "@sendgrid/mail";

async function sendMail({ to, subject, text, attachments = [] }) {
  if (process.env.BREVO_API_KEY) {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": process.env.BREVO_API_KEY,
        "content-type": "application/json",
        accept: "application/json"
      },
      body: JSON.stringify({
        sender: {
          email: process.env.BREVO_FROM || process.env.SENDGRID_FROM || "noreply@thelegacytrust.app",
          name: process.env.BREVO_FROM_NAME || "LivingTrust Counsel"
        },
        to: [{ email: to }],
        subject,
        textContent: text,
        attachment: attachments
          .map((attachment) => ({
            name: attachment.filename || attachment.name,
            content: attachment.content
          }))
          .filter((attachment) => attachment.name && attachment.content)
      })
    });
    if (!response.ok) throw new Error(`Brevo email failed: ${await response.text()}`);
    return;
  }

  if (process.env.SENDGRID_API_KEY) {
    await sgMail.send({ to, from: process.env.SENDGRID_FROM, subject, text, attachments });
    return;
  }

  console.log(`Email disabled. Would send "${subject}" to ${to}.`);
}

export async function sendWelcomeEmail({ to, name }) {
  await sendMail({
    to,
    subject: "Welcome to LivingTrust Counsel",
    text: `Hello ${name || "there"},\n\nYour LivingTrust Counsel account is ready. You can now start or continue your confidential trust intake.\n\nThis software does not provide legal advice. Attorney review is required before relying on documents.`
  });
}

export async function sendPasswordResetEmail({ to, name, resetUrl }) {
  await sendMail({
    to,
    subject: "Reset your LivingTrust Counsel password",
    text: `Hello ${name || "there"},\n\nUse this link to reset your password:\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`
  });
}

export async function sendDocumentPackage({ to, name, pdfs }) {
  await sendMail({
    to,
    subject: "Your attorney-reviewed living trust package is ready",
    text: `Hello ${name},\n\nYour attorney-reviewed trust package is attached. Review signing and funding instructions before execution.\n\nThis software does not provide legal advice.`,
    attachments: pdfs
  });
}
