-- Fashion Club Journal. Run once in the Supabase SQL editor.
create extension if not exists pgcrypto;

create or replace function public.is_fashion_admin()
returns boolean
language sql stable
set search_path = ''
as $$
  select auth.uid() is not null
    and lower(coalesce(auth.jwt() ->> 'email', '')) = 'rua5produtora@gmail.com';
$$;

create table if not exists public.fashion_media (
  id uuid primary key default gen_random_uuid(),
  path text not null unique,
  thumbnail_path text,
  filename text not null,
  alt_text text not null default '',
  width integer,
  height integer,
  bytes bigint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.fashion_stories (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('post', 'event')),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null,
  subtitle text,
  excerpt text,
  body text,
  category text not null default 'EDITORIAL' check (category in ('EDITORIAL', 'NEWS', 'EVENTOS')),
  author text,
  story_date date not null default current_date,
  cover_media_id uuid references public.fashion_media(id) on delete set null,
  gallery_media_ids uuid[] not null default '{}',
  allow_downloads boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, slug)
);

create index if not exists fashion_stories_public_order
  on public.fashion_stories (kind, story_date desc, published_at desc)
  where status = 'published';

create or replace function public.fashion_story_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  if new.status = 'published' and (old.status is distinct from 'published' or new.published_at is null) then
    new.published_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists fashion_story_updated_at on public.fashion_stories;
create trigger fashion_story_updated_at before update on public.fashion_stories
for each row execute function public.fashion_story_updated_at();

alter table public.fashion_media enable row level security;
alter table public.fashion_stories enable row level security;

revoke all on public.fashion_stories, public.fashion_media from anon, authenticated;
grant select on public.fashion_stories, public.fashion_media to anon, authenticated;
grant insert, update, delete on public.fashion_stories, public.fashion_media to authenticated;

create policy "Published stories are public" on public.fashion_stories
for select to anon, authenticated
using (status = 'published' or public.is_fashion_admin());
create policy "Only admin changes stories" on public.fashion_stories
for all to authenticated
using (public.is_fashion_admin())
with check (public.is_fashion_admin());

create policy "Published media or admin" on public.fashion_media
for select to anon, authenticated
using (
  public.is_fashion_admin()
  or exists (
    select 1 from public.fashion_stories s
    where s.status = 'published'
      and (s.cover_media_id = id or id = any(s.gallery_media_ids))
  )
);
create policy "Only admin changes media" on public.fashion_media
for all to authenticated
using (public.is_fashion_admin())
with check (public.is_fashion_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fashion-media', 'fashion-media', true, 20971520, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "Admin uploads fashion images" on storage.objects
for insert to authenticated
with check (bucket_id = 'fashion-media' and public.is_fashion_admin());
create policy "Admin lists fashion images" on storage.objects
for select to authenticated
using (bucket_id = 'fashion-media' and public.is_fashion_admin());
create policy "Admin updates fashion images" on storage.objects
for update to authenticated
using (bucket_id = 'fashion-media' and public.is_fashion_admin())
with check (bucket_id = 'fashion-media' and public.is_fashion_admin());
create policy "Admin deletes fashion images" on storage.objects
for delete to authenticated
using (bucket_id = 'fashion-media' and public.is_fashion_admin());

