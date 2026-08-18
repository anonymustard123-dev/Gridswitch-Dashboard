alter table prospects
  add column if not exists ai_research_status text not null default 'pending',
  add column if not exists ai_research jsonb,
  add column if not exists ai_researched_at timestamptz,
  add column if not exists ai_model text,
  add column if not exists ai_error text;

create index if not exists prospects_ai_research_status_idx on prospects(ai_research_status);
