import sgMail from "@sendgrid/mail";

export async function sendDocumentPackage({ to, name, pdfs }) {
  if (!process.env.SENDGRID_API_KEY) {
    console.log(`SendGrid disabled. Would send document package to ${to}.`);
    return;
  }

  await sgMail.send({
    to,
    from: process.env.SENDGRID_FROM,
    subject: "Your attorney-reviewed living trust package is ready",
    text: `Hello ${name},\n\nYour attorney-reviewed trust package is attached. Review signing and funding instructions before execution.\n\nThis software does not provide legal advice.`,
    attachments: pdfs
  });
}

export async function sendReviewReminder(trust) {
  if (!process.env.SENDGRID_API_KEY) {
    console.log(`SendGrid disabled. Would send annual review reminder to ${trust.grantor_email}.`);
    return;
  }

  await sgMail.send({
    to: trust.grantor_email,
    from: process.env.SENDGRID_FROM,
    subject: "Annual living trust review reminder",
    text: `Hello ${trust.grantor_name},\n\nIt is time to review your living trust for family, asset, law, trustee, or residence changes.`
  });
}

export async function sendAbandonedIntakeFollowUp(draft) {
  if (!draft.email) return;
  if (!process.env.SENDGRID_API_KEY) {
    console.log(`SendGrid disabled. Would send intake follow-up to ${draft.email}.`);
    return;
  }

  await sgMail.send({
    to: draft.email,
    from: process.env.SENDGRID_FROM,
    subject: "Finish your living trust intake",
    text: [
      `Hello ${draft.full_name || "there"},`,
      "",
      "You started a LivingTrust Pro intake but did not finish the package. You can return when ready and complete the missing trustee, beneficiary, distribution, or asset details.",
      "",
      "This software does not provide legal advice. Attorney review is required before delivery."
    ].join("\n")
  });
}
