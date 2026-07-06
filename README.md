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
assets/css/            Estilos (base do painel + navegação/login/histórico)
assets/js/             Lógica: utilitários, motor de geração, renderização,
                        cliente Supabase/sessão
assets/vendor/         xlsx.js e supabase-js vendorizados (sem dependência de CDN)
supabase/migrations/    Schema SQL (tabelas + funções RPC)
supabase/seed_password.example.sql   Como definir/rotacionar a senha de acesso
```

## Como funciona o acesso

Não há login individual — uma senha única libera o acesso (como um PDF
protegido). Ao validar a senha, o backend emite um token de sessão temporário
guardado em `sessionStorage` (expira ao fechar o navegador). Todo acesso às
tabelas do Supabase passa por funções RPC que conferem esse token — não há
policy de leitura/escrita direta liberada para o cliente.

## Rodando localmente

Como é um site estático, basta servir a pasta raiz:

```
python3 -m http.server 8000
```

e abrir `http://localhost:8000/index.html`.

## Deploy (Cloudflare Pages)

1. No painel da Cloudflare, crie um projeto Pages conectado a este
   repositório GitHub (branch de produção: `main`).
2. Configurações de build:
   - Framework preset: **None**
   - Build command: *(vazio)*
   - Build output directory: `/`
3. Não é necessário nenhuma variável de ambiente — a URL e a chave pública
   (anon) do Supabase já estão em `assets/js/supabase-client.js` (a chave
   anon é pública por design; o acesso real é protegido por RLS + RPC).

Com o repositório conectado, cada push na branch de produção gera um novo
deploy automaticamente.

## Banco de dados (Supabase)

Projeto: `painel-criticidade-hsm`. Schema em
`supabase/migrations/0001_painel_criticidade_schema.sql` — pode ser reaplicado
em outro projeto Supabase via SQL editor ou Supabase CLI.

Após aplicar o schema, defina a senha de acesso rodando o SQL de
`supabase/seed_password.example.sql` (substituindo o placeholder) diretamente
no SQL editor do projeto — a senha nunca deve ser versionada em texto puro.

Para rotacionar a senha depois, rode o mesmo comando novamente com a nova
senha.
