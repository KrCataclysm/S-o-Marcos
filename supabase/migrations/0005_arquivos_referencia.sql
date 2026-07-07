-- Biblioteca de arquivos de referência no ADM (Saldo do dia e Relatório de ponto de
-- pedido) — só esses dois: a Base de compras (12 meses) continua fora daqui de
-- propósito, porque passa de 15-20MB e cabe melhor no cache local do navegador
-- (já implementado em gerador.html) do que trafegando pela API a cada upload.

create table if not exists hsm_arquivos_referencia (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('saldo', 'relatorio_ponto_pedido')),
  nome_arquivo text not null,
  conteudo bytea not null,
  tamanho_bytes integer not null,
  enviado_por text,
  criado_em timestamptz not null default now()
);
create index if not exists hsm_arquivos_referencia_tipo_idx
  on hsm_arquivos_referencia (tipo, criado_em desc);

alter table hsm_arquivos_referencia enable row level security;

create or replace function rpc_admin_upload_arquivo(
  p_admin_token uuid,
  p_tipo text,
  p_nome_arquivo text,
  p_conteudo_base64 text,
  p_enviado_por text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_conteudo bytea;
  v_tamanho integer;
begin
  if not hsm_check_admin_session(p_admin_token) then
    raise exception 'sessao de admin invalida ou expirada';
  end if;
  if p_tipo not in ('saldo', 'relatorio_ponto_pedido') then
    raise exception 'tipo de arquivo invalido';
  end if;

  v_conteudo := decode(p_conteudo_base64, 'base64');
  v_tamanho := octet_length(v_conteudo);
  if v_tamanho > 10 * 1024 * 1024 then
    raise exception 'arquivo maior que 10MB — nao pode ser guardado aqui';
  end if;

  insert into hsm_arquivos_referencia(tipo, nome_arquivo, conteudo, tamanho_bytes, enviado_por)
    values (p_tipo, p_nome_arquivo, v_conteudo, v_tamanho, nullif(trim(p_enviado_por), ''))
    returning id into v_id;
  return v_id;
end;
$$;
revoke all on function rpc_admin_upload_arquivo(uuid, text, text, text, text) from public;
grant execute on function rpc_admin_upload_arquivo(uuid, text, text, text, text) to anon, authenticated;

create or replace function rpc_admin_list_arquivos(p_admin_token uuid)
returns table(
  id uuid, tipo text, nome_arquivo text, tamanho_bytes integer,
  enviado_por text, criado_em timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not hsm_check_admin_session(p_admin_token) then
    raise exception 'sessao de admin invalida ou expirada';
  end if;
  return query
    select a.id, a.tipo, a.nome_arquivo, a.tamanho_bytes, a.enviado_por, a.criado_em
    from hsm_arquivos_referencia a
    order by a.tipo, a.criado_em desc;
end;
$$;
revoke all on function rpc_admin_list_arquivos(uuid) from public;
grant execute on function rpc_admin_list_arquivos(uuid) to anon, authenticated;

create or replace function rpc_admin_download_arquivo(p_admin_token uuid, p_id uuid)
returns table(nome_arquivo text, conteudo_base64 text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not hsm_check_admin_session(p_admin_token) then
    raise exception 'sessao de admin invalida ou expirada';
  end if;
  return query
    select a.nome_arquivo, encode(a.conteudo, 'base64')
    from hsm_arquivos_referencia a
    where a.id = p_id;
end;
$$;
revoke all on function rpc_admin_download_arquivo(uuid, uuid) from public;
grant execute on function rpc_admin_download_arquivo(uuid, uuid) to anon, authenticated;

create or replace function rpc_admin_delete_arquivo(p_admin_token uuid, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not hsm_check_admin_session(p_admin_token) then
    raise exception 'sessao de admin invalida ou expirada';
  end if;
  delete from hsm_arquivos_referencia where id = p_id;
end;
$$;
revoke all on function rpc_admin_delete_arquivo(uuid, uuid) from public;
grant execute on function rpc_admin_delete_arquivo(uuid, uuid) to anon, authenticated;
