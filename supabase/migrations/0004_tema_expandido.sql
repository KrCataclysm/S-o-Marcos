-- Expande o tema editável no ADM: logo (URL) + cores da régua de criticidade.
-- Mantém cor_navy/cor_vermelho (marca) como estavam; adiciona canais próprios
-- para as 4 faixas de criticidade, hoje fixas no CSS.

alter table hsm_theme_config
  add column if not exists logo_url text,
  add column if not exists cor_critmax text not null default '#C00000',
  add column if not exists cor_crit text not null default '#e05252',
  add column if not exists cor_atencao text not null default '#e9a53a',
  add column if not exists cor_monitorar text not null default '#9aa7ba';

drop function if exists rpc_get_theme();
create function rpc_get_theme()
returns table(
  cor_navy text, cor_vermelho text, fonte text, textos jsonb,
  logo_url text, cor_critmax text, cor_crit text, cor_atencao text, cor_monitorar text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select t.cor_navy, t.cor_vermelho, t.fonte, t.textos,
           t.logo_url, t.cor_critmax, t.cor_crit, t.cor_atencao, t.cor_monitorar
    from hsm_theme_config t where t.id = 1;
  if not found then
    return query select
      '#002060'::text, '#C00000'::text, 'serif-institucional'::text, '{}'::jsonb,
      null::text, '#C00000'::text, '#e05252'::text, '#e9a53a'::text, '#9aa7ba'::text;
  end if;
end;
$$;
revoke all on function rpc_get_theme() from public;
grant execute on function rpc_get_theme() to anon, authenticated;

drop function if exists rpc_set_theme(uuid, text, text, text, jsonb);
create function rpc_set_theme(
  p_admin_token uuid,
  p_cor_navy text,
  p_cor_vermelho text,
  p_fonte text,
  p_textos jsonb,
  p_logo_url text default null,
  p_cor_critmax text default '#C00000',
  p_cor_crit text default '#e05252',
  p_cor_atencao text default '#e9a53a',
  p_cor_monitorar text default '#9aa7ba'
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

  insert into hsm_theme_config(
    id, cor_navy, cor_vermelho, fonte, textos, logo_url,
    cor_critmax, cor_crit, cor_atencao, cor_monitorar, updated_at
  )
    values (
      1, p_cor_navy, p_cor_vermelho, p_fonte, coalesce(p_textos, '{}'::jsonb), nullif(trim(p_logo_url), ''),
      p_cor_critmax, p_cor_crit, p_cor_atencao, p_cor_monitorar, now()
    )
  on conflict (id) do update set
    cor_navy = excluded.cor_navy,
    cor_vermelho = excluded.cor_vermelho,
    fonte = excluded.fonte,
    textos = excluded.textos,
    logo_url = excluded.logo_url,
    cor_critmax = excluded.cor_critmax,
    cor_crit = excluded.cor_crit,
    cor_atencao = excluded.cor_atencao,
    cor_monitorar = excluded.cor_monitorar,
    updated_at = now();
end;
$$;
revoke all on function rpc_set_theme(uuid, text, text, text, jsonb, text, text, text, text, text) from public;
grant execute on function rpc_set_theme(uuid, text, text, text, jsonb, text, text, text, text, text) to anon, authenticated;
