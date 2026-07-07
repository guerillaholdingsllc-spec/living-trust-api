import pg from "pg";

export function createPool() {
  if (!process.env.DATABASE_URL) return createMemoryPool();

  return new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
  });
}

export async function initDb(pool) {
  await pool.query(`
    create table if not exists trusts (
      id uuid primary key,
      grantor_email text not null,
      grantor_name text not null,
      state char(2) not null,
      form_json jsonb not null,
      document_json jsonb not null,
      status text not null,
      attorney_review_status text default 'pending',
      attorney_notes text,
      reviewer_name text,
      reviewer_bar_state text,
      stripe_session_id text,
      paid_at timestamptz,
      delivered_at timestamptz,
      next_review_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);

  await pool.query(`
    create table if not exists intake_drafts (
      id uuid primary key,
      email text,
      full_name text,
      state char(2) not null,
      form_json jsonb not null,
      selected_clauses jsonb not null,
      source text not null default 'web_app',
      follow_up_status text not null default 'new',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);
}

function createMemoryPool() {
  const trusts = [];
  const intakeDrafts = [];

  return {
    async query(sql, params = []) {
      const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();

      if (normalized.startsWith("create table")) return { rows: [] };

      if (normalized === "select 1") return { rows: [{ "?column?": 1 }] };

      if (normalized.startsWith("insert into trusts")) {
        const [id, grantor_email, grantor_name, state, form_json, document_json] = params;
        trusts.push({
          id,
          grantor_email,
          grantor_name,
          state,
          form_json,
          document_json,
          status: "awaiting_payment",
          attorney_review_status: "pending",
          attorney_notes: null,
          reviewer_name: null,
          reviewer_bar_state: null,
          stripe_session_id: null,
          paid_at: null,
          delivered_at: null,
          next_review_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        return { rows: [] };
      }

      if (normalized.startsWith("insert into intake_drafts")) {
        const [id, email, full_name, state, form_json, selected_clauses, source] = params;
        intakeDrafts.push({
          id,
          email,
          full_name,
          state,
          form_json,
          selected_clauses,
          source,
          follow_up_status: "new",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        return { rows: [] };
      }

      if (normalized.includes("select status, count(*)::int as count from trusts")) {
        const counts = trusts.reduce((acc, trust) => {
          acc[trust.status] = (acc[trust.status] || 0) + 1;
          return acc;
        }, {});
        return { rows: Object.entries(counts).map(([status, count]) => ({ status, count })) };
      }

      if (normalized.includes("select count(*)::int as count from intake_drafts")) {
        return { rows: [{ count: intakeDrafts.length }] };
      }

      if (normalized.includes("from trusts where status in")) {
        return {
          rows: trusts
            .filter((trust) => ["awaiting_payment", "attorney_review"].includes(trust.status))
            .slice(-8)
            .reverse()
            .map(({ id, grantor_name, grantor_email, state, status, attorney_review_status, created_at }) => ({
              id,
              grantor_name,
              grantor_email,
              state,
              status,
              attorney_review_status,
              created_at
            }))
        };
      }

      if (normalized.includes("from trusts where id = $1")) {
        return { rows: trusts.filter((trust) => trust.id === params[0]) };
      }

      if (normalized.startsWith("update trusts set attorney_review_status")) {
        const trust = trusts.find((item) => item.id === params[0]);
        if (trust) {
          trust.attorney_review_status = params[1];
          trust.attorney_notes = params[2];
          trust.reviewer_name = params[3];
          trust.reviewer_bar_state = params[4];
          trust.updated_at = new Date().toISOString();
        }
        return { rows: [] };
      }

      if (normalized.startsWith("update trusts set status = 'attorney_review'")) {
        const trust = trusts.find((item) => item.id === params[0]);
        if (trust) {
          trust.status = "attorney_review";
          trust.stripe_session_id = params[1];
          trust.paid_at = new Date().toISOString();
          trust.updated_at = new Date().toISOString();
        }
        return { rows: [] };
      }

      if (normalized.startsWith("update trusts set status = 'delivered'")) {
        const trust = trusts.find((item) => item.id === params[0]);
        if (trust) {
          trust.status = "delivered";
          trust.delivered_at = new Date().toISOString();
          trust.updated_at = new Date().toISOString();
        }
        return { rows: [] };
      }

      if (normalized.includes("from trusts where next_review_at <= now()")) {
        return { rows: trusts.filter((trust) => trust.status === "delivered") };
      }

      if (normalized.includes("from intake_drafts") && normalized.includes("follow_up_status = 'new'")) {
        return { rows: intakeDrafts.filter((draft) => draft.email && draft.follow_up_status === "new").slice(0, 25) };
      }

      if (normalized.startsWith("update intake_drafts set follow_up_status")) {
        const draft = intakeDrafts.find((item) => item.id === params[0]);
        if (draft) {
          draft.follow_up_status = "sent";
          draft.updated_at = new Date().toISOString();
        }
        return { rows: [] };
      }

      console.warn(`Memory database received unsupported query: ${sql}`);
      return { rows: [] };
    }
  };
}
