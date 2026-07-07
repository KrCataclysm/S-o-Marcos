# Painel de Criticidade de Fornecedores — HSM

Versão hospedada do gerador de painel de criticidade de fornecedores (Hospital
São Marcos — APCC), com histórico persistido e acesso restrito por senha
única. Site 100% estático (HTML/CSS/JS puro, sem build) + Supabase como
backend (senha validada por RPC + histórico de snapshots).

Especificação completa em `PAINELCRITICIDADESPEC.md` (contexto do pedido,
decisões e modelo de dados).

## Estrutura

```
index.html            Tela de senha (gate de entrada)
gerador.html           Upload das planilhas, geração e salvamento do painel
historico.html         Lista de painéis já gerados
historico-ver.html      Abertura de um painel específico, somente leitura
adm.html               Aparência do sistema (cores, fonte, textos) — senha própria
assets/css/            Estilos (base do painel + navegação/login/histórico)
assets/js/             Lógica: utilitários, motor de geração, renderização,
                        cliente Supabase/sessão, tema, comentários
assets/vendor/         xlsx.js e supabase-js vendorizados (sem dependência de CDN)
supabase/migrations/    Schema SQL (tabelas + funções RPC)
supabase/seed_password.example.sql        Como definir/rotacionar a senha de acesso
supabase/seed_admin_password.example.sql  Como definir/rotacionar a senha de admin (ADM)
```

## Como funciona o acesso

Não há login individual — uma senha única libera o acesso (como um PDF
protegido). Ao validar a senha, o backend emite um token de sessão temporário
guardado em `sessionStorage` (expira ao fechar o navegador). Todo acesso às
tabelas do Supabase passa por funções RPC que conferem esse token — não há
policy de leitura/escrita direta liberada para o cliente.

A aba **ADM** (`adm.html`) tem uma segunda senha, independente da senha de
acesso normal — só ela libera editar cores, fonte e textos da interface
(tabela `hsm_theme_config`, lida publicamente por todas as páginas para
aplicar o tema, escrita só com a sessão de admin).

## Rodando localmente

Como é um site estático, basta servir a pasta raiz:

```
python3 -m http.server 8000
```

e abrir `http://localhost:8000/index.html`.

## Deploy (GitHub Pages)

Publicado via GitHub Actions (`.github/workflows/pages.yml`) — sem build,
sobe os arquivos estáticos da raiz do repositório a cada push na `main`.

1. No repositório, em **Settings → Pages**, em "Build and deployment",
   Source deve estar como **GitHub Actions** (já configurado).
2. Cada push na `main` dispara o workflow e publica automaticamente.
3. A URL fica disponível em **Settings → Pages** (formato
   `https://<usuario>.github.io/<repositorio>/`).

Não é necessário nenhuma variável de ambiente — a URL e a chave pública
(anon) do Supabase já estão em `assets/js/supabase-client.js` (a chave
anon é pública por design; o acesso real é protegido por RLS + RPC).

## Banco de dados (Supabase)

Projeto: `painel-criticidade-hsm`. Schema em
`supabase/migrations/0001_painel_criticidade_schema.sql` — pode ser reaplicado
em outro projeto Supabase via SQL editor ou Supabase CLI.

Após aplicar o schema, defina a senha de acesso rodando o SQL de
`supabase/seed_password.example.sql` (substituindo o placeholder) diretamente
no SQL editor do projeto — a senha nunca deve ser versionada em texto puro.
Faça o mesmo com `supabase/seed_admin_password.example.sql` para a senha da
aba ADM.

Para rotacionar qualquer uma das senhas depois, rode o mesmo comando de novo
com a senha nova.
