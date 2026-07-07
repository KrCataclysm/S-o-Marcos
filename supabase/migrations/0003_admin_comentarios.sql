-- Admin: listar/editar/apagar qualquer comentário (independente de quem escreveu)

create or replace function rpc_admin_list_comentarios(p_admin_token uuid)
returns table(
  id uuid,
  painel_id uuid,
  texto text,
  criado_em timestamptz,
  data_pauta date
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
    select c.id, c.painel_id, c.texto, c.criado_em, p.data_pauta
    from hsm_painel_comentarios c
    join hsm_paineis_criticidade p on p.id = c.painel_id
    order by c.criado_em desc;
end;
$$;
revoke all on function rpc_admin_list_comentarios(uuid) from public;
grant execute on function rpc_admin_list_comentarios(uuid) to anon, authenticated;

create or replace function rpc_admin_edit_comentario(p_admin_token uuid, p_comentario_id uuid, p_texto text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_texto text;
begin
  if not hsm_check_admin_session(p_admin_token) then
    raise exception 'sessao de admin invalida ou expirada';
  end if;
  v_texto := trim(p_texto);
  if v_texto is null or v_texto = '' then
    raise exception 'comentario vazio';
  end if;
  update hsm_painel_comentarios set texto = v_texto where id = p_comentario_id;
end;
$$;
revoke all on function rpc_admin_edit_comentario(uuid, uuid, text) from public;
grant execute on function rpc_admin_edit_comentario(uuid, uuid, text) to anon, authenticated;

create or replace function rpc_admin_delete_comentario(p_admin_token uuid, p_comentario_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not hsm_check_admin_session(p_admin_token) then
    raise exception 'sessao de admin invalida ou expirada';
  end if;
  delete from hsm_painel_comentarios where id = p_comentario_id;
end;
$$;
revoke all on function rpc_admin_delete_comentario(uuid, uuid) from public;
grant execute on function rpc_admin_delete_comentario(uuid, uuid) to anon, authenticated;
