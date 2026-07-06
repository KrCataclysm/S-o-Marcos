-- Painel de Criticidade de Fornecedores (HSM)
-- Schema: senha única de acesso (sessão por token) + histórico de snapshots.
-- Não contém segredos: a senha em si é definida separadamente, fora do controle de versão.

create extension if not exists pgcrypto;

-- ---------- Configuração de acesso (senha única, linha singleton) ----------
create table if not exists hsm_access_config (
  id smallint primary key default 1,
  password_hash text not null,
  updated_at timestamptz not null default now(),
  constraint hsm_access_config_singleton check (id = 1)
);

-- ---------- Sessões emitidas após validar a senha ----------
create table if not exists hsm_sessions (
  token uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

-- ---------- Histórico de painéis gerados ----------
create table if not exists hsm_paineis_criticidade (
  id uuid primary key default gen_random_uuid(),
  data_pauta date not null,
  janela_analise int not null,
  gerado_em timestamptz not null default now(),
  gerado_por text,
  kpis jsonb not null,
  resumo_fornecedores jsonb not null,
  detalhamento jsonb not null
);

create index if not exists hsm_paineis_criticidade_data_pauta_idx
  on hsm_paineis_criticidade (data_pauta desc, gerado_em desc);

-- RLS fechada: nenhuma policy é criada, então o acesso direto às tabelas
-- fica bloqueado para anon/authenticated. Todo acesso passa pelas funções abaixo.
alter table hsm_access_config enable row level security;
alter table hsm_sessions enable row level security;
alter table hsm_paineis_criticidade enable row level security;

-- ---------- Validação de sessão (uso interno, não exposta ao cliente) ----------
create or replace function hsm_check_session(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_token is null then
    return false;
  end if;
  return exists(
    select 1 from hsm_sessions
    where token = p_token and expires_at > now()
  );
end;
$$;
revoke all on function hsm_check_session(uuid) from public;

-- ---------- Login: valida a senha única e emite um token de sessão ----------
create or replace function rpc_login(p_password text)
returns table(token uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_token uuid;
  v_expires timestamptz;
begin
  select password_hash into v_hash from hsm_access_config where id = 1;

  if v_hash is null or crypt(p_password, v_hash) <> v_hash then
    raise exception 'senha invalida';
  end if;

  v_expires := now() + interval '24 hours';
  insert into hsm_sessions(expires_at) values (v_expires) returning hsm_sessions.token into v_token;

  delete from hsm_sessions s where s.expires_at < now();

  return query select v_token, v_expires;
end;
$$;
revoke all on function rpc_login(text) from public;
grant execute on function rpc_login(text) to anon, authenticated;

-- ---------- Logout: encerra a sessão explicitamente ----------
create or replace function rpc_logout(p_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from hsm_sessions where token = p_token;
end;
$$;
revoke all on function rpc_logout(uuid) from public;
grant execute on function rpc_logout(uuid) to anon, authenticated;

-- ---------- Salva um snapshot do painel gerado ----------
create or replace function rpc_save_painel(
  p_token uuid,
  p_data_pauta date,
  p_janela_analise int,
  p_gerado_por text,
  p_kpis jsonb,
  p_resumo_fornecedores jsonb,
  p_detalhamento jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not hsm_check_session(p_token) then
    raise exception 'sessao invalida ou expirada';
  end if;

  insert into hsm_paineis_criticidade(
    data_pauta, janela_analise, gerado_por, kpis, resumo_fornecedores, detalhamento
  ) values (
    p_data_pauta, p_janela_analise, nullif(trim(p_gerado_por), ''), p_kpis, p_resumo_fornecedores, p_detalhamento
  ) returning id into v_id;

  return v_id;
end;
$$;
revoke all on function rpc_save_painel(uuid, date, int, text, jsonb, jsonb, jsonb) from public;
grant execute on function rpc_save_painel(uuid, date, int, text, jsonb, jsonb, jsonb) to anon, authenticated;

-- ---------- Lista o histórico (sem o detalhamento pesado) ----------
create or replace function rpc_list_paineis(p_token uuid)
returns table(
  id uuid,
  data_pauta date,
  janela_analise int,
  gerado_em timestamptz,
  gerado_por text,
  kpis jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not hsm_check_session(p_token) then
    raise exception 'sessao invalida ou expirada';
  end if;

  return query
    select p.id, p.data_pauta, p.janela_analise, p.gerado_em, p.gerado_por, p.kpis
    from hsm_paineis_criticidade p
    order by p.data_pauta desc, p.gerado_em desc;
end;
$$;
revoke all on function rpc_list_paineis(uuid) from public;
grant execute on function rpc_list_paineis(uuid) to anon, authenticated;

-- ---------- Recupera um snapshot completo ----------
create or replace function rpc_get_painel(p_token uuid, p_id uuid)
returns table(
  id uuid,
  data_pauta date,
  janela_analise int,
  gerado_em timestamptz,
  gerado_por text,
  kpis jsonb,
  resumo_fornecedores jsonb,
  detalhamento jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not hsm_check_session(p_token) then
    raise exception 'sessao invalida ou expirada';
  end if;

  return query
    select p.id, p.data_pauta, p.janela_analise, p.gerado_em, p.gerado_por,
           p.kpis, p.resumo_fornecedores, p.detalhamento
    from hsm_paineis_criticidade p
    where p.id = p_id;
end;
$$;
revoke all on function rpc_get_painel(uuid, uuid) from public;
grant execute on function rpc_get_painel(uuid, uuid) to anon, authenticated;
