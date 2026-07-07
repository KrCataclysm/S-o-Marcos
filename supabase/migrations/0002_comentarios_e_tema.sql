-- Comentários por painel + tema/ADM (aparência editável: cores, fonte, textos)

-- ---------- Comentários (um por painel, "Nome - Comentário" digitado livre) ----------
create table if not exists hsm_painel_comentarios (
  id uuid primary key default gen_random_uuid(),
  painel_id uuid not null references hsm_paineis_criticidade(id) on delete cascade,
  texto text not null,
  criado_em timestamptz not null default now()
);
create index if not exists hsm_painel_comentarios_painel_id_idx
  on hsm_painel_comentarios (painel_id, criado_em);

alter table hsm_painel_comentarios enable row level security;

create or replace function rpc_add_comentario(p_token uuid, p_painel_id uuid, p_texto text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_texto text;
begin
  if not hsm_check_session(p_token) then
    raise exception 'sessao invalida ou expirada';
  end if;
  v_texto := trim(p_texto);
  if v_texto is null or v_texto = '' then
    raise exception 'comentario vazio';
  end if;
  insert into hsm_painel_comentarios(painel_id, texto) values (p_painel_id, v_texto)
    returning id into v_id;
  return v_id;
end;
$$;
revoke all on function rpc_add_comentario(uuid, uuid, text) from public;
grant execute on function rpc_add_comentario(uuid, uuid, text) to anon, authenticated;

create or replace function rpc_list_comentarios(p_token uuid, p_painel_id uuid)
returns table(id uuid, texto text, criado_em timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not hsm_check_session(p_token) then
    raise exception 'sessao invalida ou expirada';
  end if;
  return query
    select c.id, c.texto, c.criado_em
    from hsm_painel_comentarios c
    where c.painel_id = p_painel_id
    order by c.criado_em asc;
end;
$$;
revoke all on function rpc_list_comentarios(uuid, uuid) from public;
grant execute on function rpc_list_comentarios(uuid, uuid) to anon, authenticated;

-- ---------- Admin: senha separada só para a aba ADM ----------
create table if not exists hsm_admin_config (
  id smallint primary key default 1,
  password_hash text not null,
  updated_at timestamptz not null default now(),
  constraint hsm_admin_config_singleton check (id = 1)
);

create table if not exists hsm_admin_sessions (
  token uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table hsm_admin_config enable row level security;
alter table hsm_admin_sessions enable row level security;

create or replace function hsm_check_admin_session(p_token uuid)
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
    select 1 from hsm_admin_sessions
    where token = p_token and expires_at > now()
  );
end;
$$;
revoke all on function hsm_check_admin_session(uuid) from public;

create or replace function rpc_admin_login(p_password text)
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
  select password_hash into v_hash from hsm_admin_config where id = 1;

  if v_hash is null or crypt(p_password, v_hash) <> v_hash then
    raise exception 'senha invalida';
  end if;

  v_expires := now() + interval '24 hours';
  insert into hsm_admin_sessions(expires_at) values (v_expires) returning hsm_admin_sessions.token into v_token;

  delete from hsm_admin_sessions s where s.expires_at < now();

  return query select v_token, v_expires;
end;
$$;
revoke all on function rpc_admin_login(text) from public;
grant execute on function rpc_admin_login(text) to anon, authenticated;

create or replace function rpc_admin_logout(p_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from hsm_admin_sessions where token = p_token;
end;
$$;
revoke all on function rpc_admin_logout(uuid) from public;
grant execute on function rpc_admin_logout(uuid) to anon, authenticated;

-- ---------- Tema: cores, fonte e textos editáveis (linha singleton) ----------
create table if not exists hsm_theme_config (
  id smallint primary key default 1,
  cor_navy text not null default '#002060',
  cor_vermelho text not null default '#C00000',
  fonte text not null default 'serif-institucional',
  textos jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint hsm_theme_config_singleton check (id = 1)
);

alter table hsm_theme_config enable row level security;

-- Leitura pública (a tela de senha também precisa aplicar o tema, antes de qualquer login).
-- Não expõe nada sensível: só cor/fonte/textos de interface.
create or replace function rpc_get_theme()
returns table(cor_navy text, cor_vermelho text, fonte text, textos jsonb)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query select t.cor_navy, t.cor_vermelho, t.fonte, t.textos from hsm_theme_config t where t.id = 1;
  if not found then
    return query select '#002060'::text, '#C00000'::text, 'serif-institucional'::text, '{}'::jsonb;
  end if;
end;
$$;
revoke all on function rpc_get_theme() from public;
grant execute on function rpc_get_theme() to anon, authenticated;

create or replace function rpc_set_theme(
  p_admin_token uuid,
  p_cor_navy text,
  p_cor_vermelho text,
  p_fonte text,
  p_textos jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not hsm_check_admin_session(p_admin_token) then
    raise exception 'sessao de admin invalida ou expirada';
  end if;

  insert into hsm_theme_config(id, cor_navy, cor_vermelho, fonte, textos, updated_at)
    values (1, p_cor_navy, p_cor_vermelho, p_fonte, coalesce(p_textos, '{}'::jsonb), now())
  on conflict (id) do update set
    cor_navy = excluded.cor_navy,
    cor_vermelho = excluded.cor_vermelho,
    fonte = excluded.fonte,
    textos = excluded.textos,
    updated_at = now();
end;
$$;
revoke all on function rpc_set_theme(uuid, text, text, text, jsonb) from public;
grant execute on function rpc_set_theme(uuid, text, text, text, jsonb) to anon, authenticated;
