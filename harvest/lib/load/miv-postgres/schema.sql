create schema if not exists miv;
set search_path = 'miv';

create table if not exists expert (
  expert_id text primary key,
  email text unique,
  ucd_person_uuid text unique,
  iam_id text unique,
  display_name text,
  updated_at timestamptz not null default current_timestamp
);

create table if not exists "grant" (
  grant_id text primary key,
  title text,
  sponsor_id text,
  sponsor_name text,
  total_award_amount numeric,
  start_date date,
  end_date date,
  status text,
  raw_payload jsonb,
  grant_types text[] not null default '{}',
  updated_at timestamptz not null default current_timestamp
);

alter table if exists "grant"
  add column if not exists raw_payload jsonb;

create table if not exists grant_role (
  role_id text primary key,
  grant_id text not null references "grant"(grant_id) on delete cascade,
  expert_id text references expert(expert_id) on delete set null,
  role_type text not null,
  role_name text,
  is_visible boolean not null default false,
  is_suppressed boolean not null default false,
  updated_at timestamptz not null default current_timestamp
);

create index if not exists idx_expert_email on expert(email);
create index if not exists idx_expert_ucd_person_uuid on expert(ucd_person_uuid);
create index if not exists idx_expert_iam_id on expert(iam_id);
create index if not exists idx_grant_start_date on "grant"(start_date);
create index if not exists idx_grant_end_date on "grant"(end_date);
create index if not exists idx_grant_role_grant_id on grant_role(grant_id);
create index if not exists idx_grant_role_expert_id on grant_role(expert_id);
create index if not exists idx_grant_role_type on grant_role(role_type);
