export async function submitAttorneyReview(trust) {
  if (!process.env.ATTORNEY_REVIEW_WEBHOOK_URL) {
    console.log(`Attorney review webhook disabled. Trust ${trust.id} is queued for internal dashboard review.`);
    return;
  }

  const response = await fetch(process.env.ATTORNEY_REVIEW_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-review-secret": process.env.ATTORNEY_REVIEW_SHARED_SECRET || ""
    },
    body: JSON.stringify({
      trustId: trust.id,
      state: trust.state,
      grantorName: trust.grantor_name,
      form: trust.form_json,
      documents: trust.document_json,
      dueWithinHours: 24
    })
  });

  if (!response.ok) throw new Error(`Attorney review webhook failed: ${response.status}`);
}
