-- ============================================================
--  BOWTIE SGI — Criação da tabela no Supabase
--  Como usar:
--  1. Abra o painel do Supabase do projeto Bowtie SGI
--  2. Menu lateral > SQL Editor > New query
--  3. Cole TODO este conteúdo e clique em "Run"
-- ============================================================

-- Tabela que guarda cada diagrama Bowtie
create table if not exists public.bowties (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  dados         jsonb not null default '{}',
  criado_em     timestamptz default now(),
  atualizado_em timestamptz default now()
);

-- Liga a segurança por linha (RLS)
alter table public.bowties enable row level security;

-- Política do MVP: permite que a chave pública (anon) leia e grave.
-- ATENÇÃO: isso deixa o acesso aberto para quem tiver o link + chave.
-- Adequado para uso interno/teste. Depois trocamos por login.
create policy "bowtie_acesso_anon" on public.bowties
  for all
  to anon
  using (true)
  with check (true);
