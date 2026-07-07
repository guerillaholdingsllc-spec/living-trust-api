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

create index if not exists trusts_status_idx on trusts (status);
create index if not exists trusts_next_review_idx on trusts (next_review_at);
create index if not exists trusts_grantor_email_idx on trusts (grantor_email);

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

create index if not exists intake_drafts_follow_up_idx on intake_drafts (follow_up_status, created_at);
create index if not exists intake_drafts_email_idx on intake_drafts (email);
