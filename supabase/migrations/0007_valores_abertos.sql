-- Valor em aberto por fornecedor, guardado no banco (não depende mais de colar a
-- pauta com uma 2ª coluna via TAB — isso continua funcionando como override manual,
-- mas agora o sistema casa pelo nome do fornecedor com o que estiver salvo aqui).

create table if not exists hsm_valores_abertos (
  id uuid primary key default gen_random_uuid(),
  nome_fornecedor text not null,
  nome_normalizado text not null unique,
  valor numeric not null,
  atualizado_em timestamptz not null default now()
);

alter table hsm_valores_abertos enable row level security;

-- Leitura pública: o gerador precisa consultar isso ao montar o painel, antes de
-- qualquer login de admin. Não expõe nada sensível — só nome de fornecedor e valor.
create or replace function rpc_get_valores_abertos()
returns table(nome_fornecedor text, nome_normalizado text, valor numeric)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query select v.nome_fornecedor, v.nome_normalizado, v.valor from hsm_valores_abertos v;
end;
$$;
revoke all on function rpc_get_valores_abertos() from public;
grant execute on function rpc_get_valores_abertos() to anon, authenticated;

-- Substitui a lista inteira (o ADM sempre manda o conteúdo completo da caixa de texto,
-- mais simples do que ficar diffando linha por linha).
create or replace function rpc_admin_set_valores_abertos(p_admin_token uuid, p_itens jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
begin
  if not hsm_check_admin_session(p_admin_token) then
    raise exception 'sessao de admin invalida ou expirada';
  end if;

  delete from hsm_valores_abertos;

  for v_item in select * from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb))
  loop
    insert into hsm_valores_abertos(nome_fornecedor, nome_normalizado, valor)
      values (
        v_item->>'nome',
        lower(trim(v_item->>'nome')),
        (v_item->>'valor')::numeric
      )
    on conflict (nome_normalizado) do update set
      nome_fornecedor = excluded.nome_fornecedor,
      valor = excluded.valor,
      atualizado_em = now();
  end loop;
end;
$$;
revoke all on function rpc_admin_set_valores_abertos(uuid, jsonb) from public;
grant execute on function rpc_admin_set_valores_abertos(uuid, jsonb) to anon, authenticated;
