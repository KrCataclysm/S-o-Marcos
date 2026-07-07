-- Permite ao ADM apagar um painel do histórico (importar um novo continua usando
-- rpc_save_painel, já existente — quem está na aba ADM já tem sessão normal válida).

create or replace function rpc_admin_delete_painel(p_admin_token uuid, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not hsm_check_admin_session(p_admin_token) then
    raise exception 'sessao de admin invalida ou expirada';
  end if;
  delete from hsm_paineis_criticidade where id = p_id;
end;
$$;
revoke all on function rpc_admin_delete_painel(uuid, uuid) from public;
grant execute on function rpc_admin_delete_painel(uuid, uuid) to anon, authenticated;
