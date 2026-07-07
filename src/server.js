import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import Stripe from "stripe";
import sgMail from "@sendgrid/mail";
import cron from "node-cron";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import { pathToFileURL } from "url";
import { createPool, initDb } from "./services/db.js";
import { generateAttorneyReviewPacket, generateIntakeGuidance, generateLeadBrief, generateTrustPackage } from "./services/llm.js";
import { buildPdfPackage } from "./services/pdf.js";
import { sendAbandonedIntakeFollowUp, sendDocumentPackage, sendReviewReminder } from "./services/email.js";
import { submitAttorneyReview } from "./services/attorney.js";
import { STATE_RULES } from "./stateRules.js";

const app = express();
const port = process.env.PORT || 8080;
const pool = createPool();
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

if (process.env.SENDGRID_API_KEY) sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const TrustSubmission = z.object({
  grantor: z.object({
    fullName: z.string().min(2),
    email: z.string().email(),
    state: z.string().length(2),
    address: z.string().optional().default("")
  }),
  questionnaire: z.record(z.any()).default({}),
  clauses: z.array(z.string()).default([]),
  assets: z.array(z.record(z.any())).default([]),
  packageType: z.enum(["base", "family"]).optional().default("base"),
  previewAccepted: z.boolean().optional().default(false)
});

const MaintenanceCheckout = z.object({
  email: z.string().email().optional().or(z.literal("")).default(""),
  fullName: z.string().optional().default(""),
  state: z.string().length(2).optional().default("CA")
});

const CHECKOUT_PACKAGES = {
  base: {
    amount: 39700,
    name: "LivingTrust Base Document Preparation",
    description: "Guided living trust intake, asset inventory, review-ready document packet, funding checklist, and state execution notes."
  },
  family: {
    amount: 99700,
    name: "LivingTrust Family Document Preparation",
    description: "Expanded document preparation for couples, blended families, minor children, multiple asset classes, and trustee instructions."
  }
};

const MAINTENANCE_PLAN = {
  amount: 14900,
  name: "LivingTrust Annual Maintenance",
  description: "Annual trust review reminders, asset inventory refresh, beneficiary audit prompts, and organized change history."
};

const IntakeDraft = z.object({
  email: z.string().email().optional().or(z.literal("")).default(""),
  fullName: z.string().optional().default(""),
  state: z.string().length(2).optional().default("CA"),
  form: z.record(z.any()).default({}),
  selectedClauses: z.array(z.string()).default([]),
  source: z.string().optional().default("web_app")
});

const LeadBriefRequest = z.object({
  market: z.string().optional().default("United States"),
  audience: z.string().optional().default("homeowners, parents, business owners, and families planning for probate avoidance"),
  offer: z.string().optional().default("Attorney-reviewed living trust package with guided intake, PDFs, funding instructions, and annual review reminders")
});

app.use(helmet());
app.use(cors({ origin: process.env.WEB_ORIGIN?.split(",") || "*" }));

app.post("/webhooks/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    if (!stripe) return res.status(503).send("Stripe is not configured");
    const signature = req.headers["stripe-signature"];
    const event = process.env.STRIPE_WEBHOOK_SECRET
      ? stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET)
      : JSON.parse(req.body.toString());

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const trustId = session.metadata?.trustId;
      if (trustId) await markPaidAndRouteForReview(trustId, session.id);
    }
    res.json({ received: true });
  } catch (error) {
    console.error(error);
    res.status(400).send(`Webhook error: ${error.message}`);
  }
});

app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, stateRules: Object.keys(STATE_RULES).length });
});

app.get("/readiness", async (_req, res) => {
  const checks = {
    database: false,
    stateRules: Object.keys(STATE_RULES).length > 0,
    openai: Boolean(process.env.OPENAI_API_KEY),
    stripe: Boolean(process.env.STRIPE_SECRET_KEY),
    stripeWebhook: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    sendgrid: Boolean(process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM),
    attorneyReview: Boolean(process.env.ATTORNEY_REVIEW_WEBHOOK_URL),
    webOrigin: Boolean(process.env.WEB_ORIGIN)
  };

  try {
    await pool.query("select 1");
    checks.database = true;
  } catch (error) {
    checks.database = false;
  }

  const requiredForLaunch = ["database", "stateRules", "openai", "stripe", "stripeWebhook", "sendgrid", "webOrigin"];
  const missing = requiredForLaunch.filter((name) => !checks[name]);

  res.status(missing.length ? 503 : 200).json({
    ok: missing.length === 0,
    mode: process.env.NODE_ENV || "development",
    checks,
    missing,
    warnings: checks.attorneyReview ? [] : ["ATTORNEY_REVIEW_WEBHOOK_URL is not set; paid trusts will queue for internal dashboard review."]
  });
});

app.get("/state-rules/:state", (req, res) => {
  const state = req.params.state.toUpperCase();
  const rules = STATE_RULES[state];
  if (!rules) return res.status(404).json({ error: "Unsupported state" });
  res.json(rules);
});

app.post("/intake-assist", async (req, res) => {
  try {
    const state = String(req.body?.form?.state || req.body?.state || "CA").toUpperCase();
    const stateRules = STATE_RULES[state];
    const guidance = await generateIntakeGuidance({ ...req.body, stateRules });
    res.json(guidance);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/intake-drafts", async (req, res) => {
  try {
    const input = IntakeDraft.parse(req.body);
    const draftId = uuid();
    await pool.query(
      `insert into intake_drafts (id, email, full_name, state, form_json, selected_clauses, source)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [draftId, input.email || null, input.fullName || null, input.state.toUpperCase(), input.form, input.selectedClauses, input.source]
    );
    res.status(201).json({ draftId, message: "Intake progress saved for follow-up." });
  } catch (error) {
    console.error(error);
    res.status(error instanceof z.ZodError ? 422 : 500).json({ error: error.message });
  }
});

app.get("/operations-brief", async (_req, res) => {
  try {
    const [{ rows: statusRows }, { rows: draftRows }, { rows: reviewRows }] = await Promise.all([
      pool.query("select status, count(*)::int as count from trusts group by status order by status"),
      pool.query("select count(*)::int as count from intake_drafts where created_at >= now() - interval '7 days'"),
      pool.query("select id, grantor_name, grantor_email, state, status, attorney_review_status, created_at from trusts where status in ('awaiting_payment', 'attorney_review') order by created_at desc limit 8")
    ]);

    const counts = Object.fromEntries(statusRows.map((row) => [row.status, row.count]));
    const total = statusRows.reduce((sum, row) => sum + row.count, 0);
    const brief = {
      generatedAt: new Date().toISOString(),
      scorecard: {
        totalTrusts: total,
        awaitingPayment: counts.awaiting_payment || 0,
        attorneyReview: counts.attorney_review || 0,
        delivered: counts.delivered || 0,
        abandonedDrafts7d: draftRows[0]?.count || 0
      },
      queue: reviewRows,
      nextActions: [
        "Follow up with saved drafts that have email addresses but no payment.",
        "Clear attorney review items older than 24 hours.",
        "Review state-specific risk flags before approval.",
        "Run today's lead brief and add one partner prospect batch."
      ]
    };
    res.json(brief);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/lead-brief", async (req, res) => {
  try {
    const input = LeadBriefRequest.parse(req.body);
    const brief = await generateLeadBrief(input);
    res.json(brief);
  } catch (error) {
    console.error(error);
    res.status(error instanceof z.ZodError ? 422 : 500).json({ error: error.message });
  }
});

app.post("/generate-trust", async (req, res) => {
  try {
    const input = TrustSubmission.parse(req.body);
    const stateRules = STATE_RULES[input.grantor.state.toUpperCase()];
    if (!stateRules) return res.status(400).json({ error: "State-specific rules are required before generation." });

    const trustId = uuid();
    const packageJson = await generateTrustPackage({ ...input, stateRules });
    await pool.query(
      `insert into trusts (id, grantor_email, grantor_name, state, form_json, document_json, status, next_review_at)
       values ($1, $2, $3, $4, $5, $6, 'awaiting_payment', now() + interval '1 year')`,
      [trustId, input.grantor.email, input.grantor.fullName, input.grantor.state.toUpperCase(), input, packageJson]
    );

    const checkoutUrl = await createCheckoutSession(trustId, input.grantor.email, input.packageType);
    res.status(201).json({
      trustId,
      status: "awaiting_payment",
      checkoutUrl,
      message: "Draft generated. Continue to secure checkout for your document preparation package."
    });
  } catch (error) {
    console.error(error);
    res.status(error instanceof z.ZodError ? 422 : 500).json({ error: error.message });
  }
});

app.post("/checkout/maintenance", async (req, res) => {
  try {
    const input = MaintenanceCheckout.parse(req.body);
    const checkoutUrl = await createMaintenanceCheckout(input);
    res.status(201).json({
      checkoutUrl,
      message: "Annual maintenance checkout is ready."
    });
  } catch (error) {
    console.error(error);
    res.status(error instanceof z.ZodError ? 422 : 500).json({ error: error.message });
  }
});

app.get("/trusts/:id", async (req, res) => {
  const { rows } = await pool.query(
    "select id, grantor_email, grantor_name, state, status, attorney_review_status, created_at, updated_at, next_review_at from trusts where id = $1",
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Trust not found" });
  res.json(rows[0]);
});

app.get("/trusts/:id/review-packet", async (req, res) => {
  try {
    const { rows } = await pool.query("select * from trusts where id = $1", [req.params.id]);
    const trust = rows[0];
    if (!trust) return res.status(404).json({ error: "Trust not found" });
    const stateRules = STATE_RULES[trust.state];
    const packet = await generateAttorneyReviewPacket({ trust, stateRules });
    res.json(packet);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/webhooks/attorney-review", async (req, res) => {
  const { trustId, status, notes, reviewerName, reviewerBarState } = req.body;
  if (!trustId || !["approved", "changes_requested", "rejected"].includes(status)) {
    return res.status(422).json({ error: "Invalid attorney review payload" });
  }

  await pool.query(
    `update trusts
     set attorney_review_status = $2, attorney_notes = $3, reviewer_name = $4, reviewer_bar_state = $5, updated_at = now()
     where id = $1`,
    [trustId, status, notes || "", reviewerName || "", reviewerBarState || ""]
  );

  if (status === "approved") await deliverPackage(trustId);
  res.json({ ok: true });
});

async function createCheckoutSession(trustId, email, packageType = "base") {
  const selectedPackage = CHECKOUT_PACKAGES[packageType] || CHECKOUT_PACKAGES.base;
  if (!stripe) return `${process.env.WEB_ORIGIN || "http://localhost:5173"}/success?trustId=${trustId}&devCheckout=true`;
  const amount = Number(process.env[`STRIPE_${packageType.toUpperCase()}_PRICE_AMOUNT`] || selectedPackage.amount);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: email,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: amount,
        product_data: {
          name: selectedPackage.name,
          description: selectedPackage.description
        }
      }
    }],
    success_url: `${process.env.WEB_ORIGIN}/success?trustId=${trustId}`,
    cancel_url: `${process.env.WEB_ORIGIN}/cancel?trustId=${trustId}`,
    metadata: { trustId, packageType, product: selectedPackage.name }
  });
  return session.url;
}

async function createMaintenanceCheckout(input) {
  if (!stripe) return `${process.env.WEB_ORIGIN || "http://localhost:5173"}/success?maintenance=devCheckout`;
  const amount = Number(process.env.STRIPE_MAINTENANCE_PRICE_AMOUNT || MAINTENANCE_PLAN.amount);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: input.email || undefined,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: amount,
        recurring: { interval: "year" },
        product_data: {
          name: MAINTENANCE_PLAN.name,
          description: MAINTENANCE_PLAN.description
        }
      }
    }],
    success_url: `${process.env.WEB_ORIGIN}/success?maintenance=active`,
    cancel_url: `${process.env.WEB_ORIGIN}/cancel?maintenance=cancelled`,
    metadata: {
      product: MAINTENANCE_PLAN.name,
      fullName: input.fullName,
      state: input.state
    }
  });
  return session.url;
}

async function markPaidAndRouteForReview(trustId, stripeSessionId) {
  const { rows } = await pool.query("select * from trusts where id = $1", [trustId]);
  const trust = rows[0];
  if (!trust) throw new Error("Trust not found");

  await pool.query(
    "update trusts set status = 'attorney_review', stripe_session_id = $2, paid_at = now(), updated_at = now() where id = $1",
    [trustId, stripeSessionId]
  );
  await submitAttorneyReview(trust);
}

async function deliverPackage(trustId) {
  const { rows } = await pool.query("select * from trusts where id = $1", [trustId]);
  const trust = rows[0];
  if (!trust) throw new Error("Trust not found");

  const pdfs = await buildPdfPackage(trust.document_json);
  await sendDocumentPackage({ to: trust.grantor_email, name: trust.grantor_name, pdfs });
  await pool.query("update trusts set status = 'delivered', delivered_at = now(), updated_at = now() where id = $1", [trustId]);
}

cron.schedule("0 9 * * *", async () => {
  const { rows } = await pool.query(
    "select id, grantor_email, grantor_name from trusts where next_review_at <= now() and status = 'delivered'"
  );
  for (const trust of rows) await sendReviewReminder(trust);
});

cron.schedule("30 16 * * *", async () => {
  const { rows } = await pool.query(
    `select id, email, full_name from intake_drafts
     where email is not null
       and follow_up_status = 'new'
       and created_at <= now() - interval '1 day'
     order by created_at asc
     limit 25`
  );
  for (const draft of rows) {
    await sendAbandonedIntakeFollowUp(draft);
    await pool.query("update intake_drafts set follow_up_status = 'sent', updated_at = now() where id = $1", [draft.id]);
  }
});

export { app, pool };

export async function startServer() {
  await initDb(pool);
  return app.listen(port, () => console.log(`Living Trust API listening on ${port}`));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
