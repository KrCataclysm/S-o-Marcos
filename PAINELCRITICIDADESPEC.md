# Especificação — Painel de Criticidade de Fornecedores (HSM)
### Versão web com histórico e acesso restrito por senha

---

## 1. Contexto

Hoje existe o **Gerador_Painel_Criticidade_HSM.html**, uma ferramenta client-side (roda 100% no navegador, sem backend). O fluxo atual é:

1. Usuário abre o HTML localmente.
2. Sobe manualmente as planilhas da rodada (estoque, relatório de medicamentos/materiais, pauta de pagamento, saldo).
3. O próprio JavaScript (via `xlsx.js`) cruza os dados e monta o painel na hora — KPIs, régua de criticidade, resumo por fornecedor, detalhamento item x fornecedor x estoque.
4. Painel pode ser exportado para Excel/PDF.

**Limitação central:** nada é salvo. Cada geração é uma "foto" isolada. Fechar a aba = perder o resultado. Não existe login, não existe histórico, não existe link fixo para compartilhar com terceiros.

## 2. Pedido (Edgar Agnussem)

Solicitação recebida via WhatsApp, resumida em 3 pontos:

1. **Versão hospedada e mais profissional** — ele mencionou GitHub, mas o requisito real é "ter um link, bonito, e não precisar do arquivo HTML solto". Qualquer hospedagem estática serve (GitHub Pages, Cloudflare Pages, etc.) — decisão técnica, não requisito do cliente.
2. **Histórico de mapeamentos** — os diretores precisam conseguir ver painéis de rodadas anteriores, não só a última geração. Termos usados por ele: *"histórico de mapeamento"*, *"histórico de resultados"*.
3. **Acesso restrito por senha única** — **sem usuário**, sem cadastro individual. Uma senha compartilhada entre quem tem permissão de ver, no estilo de um PDF protegido. Citação direta: *"Cria só tipo: senha para entrar no sistema. Tipo quando tem PDF que tá bloqueado."*

Público do histórico: diretores da HSM (visualização), além de quem já usa a ferramenta hoje (Junior/Fabiana/Juliana, compradores).

## 3. Escopo funcional

### 3.1 Geração do painel (mantém o que já existe)
- Upload das planilhas da rodada.
- Processamento e cruzamento de dados (lógica já implementada no HTML atual — reaproveitar, não recriar).
- Exibição do painel: KPIs, régua de criticidade, resumo por fornecedor, detalhamento.

### 3.2 Novo: persistência (histórico)
- Ao gerar um painel, o resultado é **salvo automaticamente** como um "snapshot" da rodada.
- Cada snapshot guarda: data da pauta, janela de análise, KPIs, tabela de resumo por fornecedor, tabela de detalhamento completa.
- Lista de histórico: navegação por data da pauta, com abertura de qualquer rodada anterior em modo somente leitura.
- **Decisão a confirmar:** as planilhas brutas (xlsx/xls originais) também precisam ficar guardadas, ou só o resultado processado (JSON/tabelas) já resolve? Guardar os brutos custa mais espaço e complexidade; guardar só o processado é suficiente pra "ver o histórico do resultado", que é o que foi pedido.
  → **Recomendação:** guardar só o resultado processado. Se um dia precisar reprocessar, sobe a planilha de novo.

### 3.3 Novo: acesso por senha única
- Tela de entrada com campo único de senha (sem usuário, sem e-mail).
- Senha correta libera acesso a: geração de novo painel + histórico completo.
- Sem diferenciação de papel/permissão por usuário (todo mundo que tem a senha gera painel e vê o histórico).
- Sessão expira ao fechar o navegador — sem tempo fixo.

### 3.4 Fora de escopo (nesta fase)
- Login individual com usuário/senha por pessoa.
- Edição colaborativa em tempo real.
- Notificações automáticas (e-mail/WhatsApp) quando um novo painel é gerado.
- Controle de permissão granular (quem pode gerar vs. quem só visualiza).

## 4. Arquitetura proposta

Padrão já validado em outros projetos (NUPIEEPRO, Lojinha, Controle AEE): **frontend estático + Supabase como backend.**

```
┌─────────────────────────┐
│   Frontend (estático)   │  ← Cloudflare Pages
│  - Tela de senha         │
│  - Gerador (HTML atual   │
│    reaproveitado)        │
│  - Tela de histórico     │
└───────────┬──────────────┘
            │
            ▼
┌─────────────────────────┐
│       Supabase           │
│  - Tabela: snapshots      │  ← histórico de painéis
│  - Tabela/config: senha   │  ← senha única de acesso
│  - RLS (regras de acesso) │
└─────────────────────────┘
```

### Por que Supabase e não algo mais simples (ex.: senha fixa no JS)?
- Senha fixa hardcoded no HTML é visível no código-fonte (F12 no navegador mostra tudo) — não protege nada de fato, só cria fricção cosmética. Como o pedido explicitamente compara a um "PDF bloqueado", o mínimo aceitável é a senha não estar exposta em texto puro no frontend.
- Supabase permite: senha validada no backend (Edge Function ou RPC), histórico persistido, e reaproveita a stack que você já domina — sem curva de aprendizado nova.
- Alternativa mais leve (se quiser evitar Supabase): senha com hash validado via GitHub Pages + serviço serverless simples (ex.: Cloudflare Worker) só para checar a senha, e histórico salvo em outro lugar. Mais peças soltas, não recomendo pra esse caso.

**Recomendação:** Supabase completo (auth simplificado por senha única + tabela de histórico). Reaproveita padrão conhecido, resolve os dois requisitos (senha + histórico) na mesma peça.

## 5. Modelo de dados (rascunho)

**Tabela `paineis_criticidade`**

| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid | PK |
| data_pauta | date | Data da pauta de pagamento |
| janela_analise | int | Dias da janela (ex.: 90) |
| gerado_em | timestamp | Quando o snapshot foi criado |
| kpis | jsonb | Fornecedores na pauta, valor total, itens críticos, itens analisados |
| resumo_fornecedores | jsonb | Tabela "Resumo por fornecedor" |
| detalhamento | jsonb | Tabela "Detalhamento — itens x fornecedores x estoque" |
| gerado_por | text | Identificação opcional (nome digitado, já que não há login individual) |

**Acesso:** RLS aberta pra leitura/escrita mediante posse da senha validada na sessão (token temporário emitido após validar a senha, não necessariamente Supabase Auth completo).

## 6. Estilo visual

Pedido de Edgar: *"mais bonito"*. O HTML atual já tem identidade (navy + vermelho crítico, serifada institucional) — a recomendação é **manter a linguagem visual e elevar o acabamento**: espaçamento, tipografia, transições sutis nas tabelas, ao invés de redesenhar do zero. Evita retrabalho e mantém a leitura já familiar aos diretores.

## 7. Decisões fechadas

1. **Planilhas brutas:** não são guardadas no histórico. Só o resultado processado (KPIs, resumo por fornecedor, detalhamento) é salvo em cada snapshot.
2. **Sessão:** expira ao fechar o navegador. Sem tempo fixo — reabrir exige senha de novo.
3. **Senha:** JR e Edgar têm acesso nesta entrega (fase de teste). Único nível — ambos podem gerar painel e ver histórico.
4. **Hospedagem:** Cloudflare Pages.
5. **Nível de acesso:** único. Quem tem a senha gera painel e visualiza histórico — sem distinção entre "gerador" e "visualizador".

## 8. Próximos passos

Com os pontos da seção 7 fechados, o desenvolvimento segue a ordem:

1. Schema no Supabase (tabela de snapshots + mecanismo de senha).
2. Tela de senha (gate de entrada).
3. Adaptação do gerador atual para, ao concluir o processamento, salvar o snapshot no Supabase em vez de só exibir na tela.
4. Tela de histórico (lista por data + abertura em modo leitura).
5. Ajustes visuais finais.
