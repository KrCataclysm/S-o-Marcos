-- Defina/rotacione a senha única de acesso.
-- Rode manualmente no SQL editor do Supabase (não é uma migration, não deve ser versionado com a senha real).

insert into hsm_access_config (id, password_hash)
values (1, crypt('SUBSTITUA_PELA_SENHA', gen_salt('bf')))
on conflict (id) do update set password_hash = excluded.password_hash, updated_at = now();
