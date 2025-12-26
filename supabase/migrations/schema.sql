-- supabase/migrations/schema.sql

-- ============================================================================
-- Dynamic Portfolio Platform (MVP Schema + RLS)
-- ============================================================================
-- Goals:
-- - Admin CMS with unlimited folders/subfolders (content tree)
-- - Projects/blogs inside folders
-- - Public site reads only PUBLISHED content
-- - Admin-only CRUD (via admins table)
-- - AI workflow fields (draft -> approve -> publish)
-- - Analytics events storage (basic)
-- ============================================================================

-- -------------------------
-- Extensions
-- -------------------------
create extension if not exists "pgcrypto";

-- -------------------------
-- Helper: updated_at trigger
-- -------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -------------------------
-- Admin Gate
-- -------------------------
create table if not exists public.admins (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- Only admins can read admins table (avoid leaking list)
drop policy if exists "admins_select_admin_only" on public.admins;
create policy "admins_select_admin_only"
on public.admins
for select
to authenticated
using (id = auth.uid());

-- Only admins can manage admins (you can tighten later)
drop policy if exists "admins_all_admin_only" on public.admins;

-- Disable write access from client (manage admins via SQL/dashboard/service role only)
create policy "admins_no_write"
on public.admins
for all
to authenticated
using (false)
with check (false);

-- Function used by RLS everywhere
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins a
    where a.id = auth.uid()
  );
$$;


-- ============================================================================
-- Content Tree (folders + items)
-- ============================================================================
-- content_nodes represents a tree of nodes:
-- - node_type = 'folder' OR 'project' OR 'blog' OR 'section' (extend later)
-- - parent_id for nesting
-- - ref_id points to the actual row in the corresponding table (nullable for folders)
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'content_node_type') then
    create type public.content_node_type as enum ('folder', 'section', 'project', 'blog');
  end if;
end $$;

create table if not exists public.content_nodes (
  id uuid primary key default gen_random_uuid(),

  parent_id uuid null references public.content_nodes(id) on delete cascade,

  node_type public.content_node_type not null default 'folder',

  -- display fields
  title text not null,
  slug text null,

  -- link to actual content row (projects/blogs/sections)
  ref_id uuid null,

  -- ordering within a folder
  order_index integer not null default 0,

  -- optional metadata
  icon text null,
  description text null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_content_nodes_parent on public.content_nodes(parent_id);
create index if not exists idx_content_nodes_type on public.content_nodes(node_type);
create index if not exists idx_content_nodes_ref on public.content_nodes(ref_id);

drop trigger if exists trg_content_nodes_updated_at on public.content_nodes;
create trigger trg_content_nodes_updated_at
before update on public.content_nodes
for each row execute function public.set_updated_at();

alter table public.content_nodes enable row level security;

-- Admin full access
drop policy if exists "content_nodes_all_admin" on public.content_nodes;
create policy "content_nodes_all_admin"
on public.content_nodes
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- No public access to tree structure by default (admin CMS only)

-- ============================================================================
-- Sections (dynamic page engine)
-- ============================================================================
create table if not exists public.sections (
  id uuid primary key default gen_random_uuid(),

  -- The dynamic rendering key (e.g., "hero", "about", "stats", "cta")
  kind text not null,

  title text null,
  subtitle text null,

  -- Schema-flexible payload for your section renderer
  data jsonb not null default '{}'::jsonb,

  is_published boolean not null default true,
  order_index integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sections_kind on public.sections(kind);
create index if not exists idx_sections_published on public.sections(is_published, order_index);

drop trigger if exists trg_sections_updated_at on public.sections;
create trigger trg_sections_updated_at
before update on public.sections
for each row execute function public.set_updated_at();

alter table public.sections enable row level security;

-- Public can read only published sections
drop policy if exists "sections_select_public_published" on public.sections;
create policy "sections_select_public_published"
on public.sections
for select
to anon, authenticated
using (is_published = true);

-- Admin CRUD
drop policy if exists "sections_all_admin" on public.sections;
create policy "sections_all_admin"
on public.sections
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ============================================================================
-- Projects
-- ============================================================================
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),

  slug text not null unique,
  title text not null,
  summary text null,
  description text null,

  cover_image text null,

  tags text[] null,
  tech_stack text[] null,

  live_url text null,
  repo_url text null,

  status text null,

  is_featured boolean not null default false,

  -- publication
  is_published boolean not null default false,

  -- AI workflow
  ai_readme_draft text null,
  ai_readme_approved boolean not null default false,

  order_index integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_projects_published on public.projects(is_published, order_index);
create index if not exists idx_projects_featured on public.projects(is_featured);

drop trigger if exists trg_projects_updated_at on public.projects;
create trigger trg_projects_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

alter table public.projects enable row level security;

-- Public can read only published projects
drop policy if exists "projects_select_public_published" on public.projects;
create policy "projects_select_public_published"
on public.projects
for select
to anon, authenticated
using (is_published = true);

-- Admin CRUD
drop policy if exists "projects_all_admin" on public.projects;
create policy "projects_all_admin"
on public.projects
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ============================================================================
-- Blogs
-- ============================================================================
create table if not exists public.blogs (
  id uuid primary key default gen_random_uuid(),

  slug text not null unique,
  title text not null,
  excerpt text null,

  -- markdown or rich content
  content text not null default '',

  cover_image text null,

  tags text[] null,

  -- publication
  is_published boolean not null default false,
  published_at timestamptz null,

  -- AI workflow
  ai_draft text null,
  ai_draft_approved boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_blogs_published on public.blogs(is_published, published_at);
create index if not exists idx_blogs_slug on public.blogs(slug);

drop trigger if exists trg_blogs_updated_at on public.blogs;
create trigger trg_blogs_updated_at
before update on public.blogs
for each row execute function public.set_updated_at();

alter table public.blogs enable row level security;

-- Public can read only published blogs
drop policy if exists "blogs_select_public_published" on public.blogs;
create policy "blogs_select_public_published"
on public.blogs
for select
to anon, authenticated
using (is_published = true);

-- Admin CRUD
drop policy if exists "blogs_all_admin" on public.blogs;
create policy "blogs_all_admin"
on public.blogs
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ============================================================================
-- Skills
-- ============================================================================
create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  level text null,
  category text null,
  order_index integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_skills_published on public.skills(is_published, order_index);

drop trigger if exists trg_skills_updated_at on public.skills;
create trigger trg_skills_updated_at
before update on public.skills
for each row execute function public.set_updated_at();

alter table public.skills enable row level security;

drop policy if exists "skills_select_public_published" on public.skills;
create policy "skills_select_public_published"
on public.skills
for select
to anon, authenticated
using (is_published = true);

drop policy if exists "skills_all_admin" on public.skills;
create policy "skills_all_admin"
on public.skills
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ============================================================================
-- Timeline / Experience
-- ============================================================================
create table if not exists public.timeline (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  org text null,
  location text null,
  start_date date null,
  end_date date null,
  is_current boolean not null default false,
  description text null,
  order_index integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_timeline_published on public.timeline(is_published, order_index);

drop trigger if exists trg_timeline_updated_at on public.timeline;
create trigger trg_timeline_updated_at
before update on public.timeline
for each row execute function public.set_updated_at();

alter table public.timeline enable row level security;

drop policy if exists "timeline_select_public_published" on public.timeline;
create policy "timeline_select_public_published"
on public.timeline
for select
to anon, authenticated
using (is_published = true);

drop policy if exists "timeline_all_admin" on public.timeline;
create policy "timeline_all_admin"
on public.timeline
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ============================================================================
-- Global Settings (single row approach)
-- ============================================================================
create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_settings_updated_at on public.settings;
create trigger trg_settings_updated_at
before update on public.settings
for each row execute function public.set_updated_at();

alter table public.settings enable row level security;

-- Public can read settings (safe keys only stored here)
drop policy if exists "settings_select_public" on public.settings;
create policy "settings_select_public"
on public.settings
for select
to anon, authenticated
using (true);

-- Admin CRUD
drop policy if exists "settings_all_admin" on public.settings;
create policy "settings_all_admin"
on public.settings
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ============================================================================
-- Media (metadata; actual files live in Storage)
-- ============================================================================
create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  bucket text not null default 'media',
  mime_type text null,
  size_bytes bigint null,
  alt text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_media_bucket on public.media(bucket);

alter table public.media enable row level security;

-- Public can read media metadata (files still protected by Storage rules)
drop policy if exists "media_select_public" on public.media;
create policy "media_select_public"
on public.media
for select
to anon, authenticated
using (true);

-- Admin CRUD
drop policy if exists "media_all_admin" on public.media;
create policy "media_all_admin"
on public.media
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ============================================================================
-- Analytics Events (basic)
-- ============================================================================
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  path text null,
  referrer text null,
  user_agent text null,
  ip text null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_analytics_events_name on public.analytics_events(event_name);
create index if not exists idx_analytics_events_created on public.analytics_events(created_at desc);

alter table public.analytics_events enable row level security;

-- Public can INSERT analytics (rate-limit at API layer)
drop policy if exists "analytics_insert_public" on public.analytics_events;
create policy "analytics_insert_public"
on public.analytics_events
for insert
to anon, authenticated
with check (true);

-- Admin can read analytics
drop policy if exists "analytics_select_admin" on public.analytics_events;
create policy "analytics_select_admin"
on public.analytics_events
for select
to authenticated
using (public.is_admin());

-- ============================================================================
-- Storage bucket (optional SQL; may require privileges)
-- ============================================================================
-- Note: Some Supabase setups prefer creating buckets in the dashboard UI.
-- This is safe to keep; if it fails, create bucket manually named "media".
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'media') then
    insert into storage.buckets (id, name, public)
    values ('media', 'media', true);
  end if;
exception
  when undefined_table then
    -- storage schema not available in some local setups
    null;
end $$;

-- ============================================================================
-- Seed (optional): settings baseline
-- ============================================================================
insert into public.settings (key, value)
values
  ('site', jsonb_build_object(
    'title', 'AI 3D Portfolio Platform',
    'description', 'A fully dynamic, SEO-first, AI-powered personal platform.',
    'contactEmail', '',
    'socials', jsonb_build_object()
  ))
on conflict (key) do nothing;
