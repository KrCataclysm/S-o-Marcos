-- Defina/rotacione a senha de administrador (aba ADM — aparência do sistema).
-- Separada da senha de acesso normal. Rode manualmente no SQL editor do
-- Supabase (não é uma migration, não deve ser versionado com a senha real).

insert into hsm_admin_config (id, password_hash)
values (1, crypt('SUBSTITUA_PELA_SENHA_DE_ADMIN', gen_salt('bf')))
on conflict (id) do update set password_hash = excluded.password_hash, updated_at = now();
