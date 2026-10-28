# Changelog

## [1.8.0] — 2026-10-28

### Segurança — 20 vulnerabilidades para 4, nenhuma crítica ou alta

O `npm audit` acusava **8 críticas e 8 altas**. Duas das críticas importavam de
verdade, e uma delas era explorável por qualquer visitante:

| Advisory              | CVSS | Impacto                                             |
| --------------------- | ---- | --------------------------------------------------- |
| `GHSA-qx66-fv34-fjm8` | 9,3  | XSS refletido **não autenticado**                   |
| `GHSA-p6vx-979v-rg4c` | 9,8  | `seroval`: execução de callables na desserialização |

O XSS: um atacante montava uma URL para uma server function; quem abrisse o link
recebia HTML controlado por ele **na origem do app**, com acesso aos dados
daquela sessão. Corrigido em `@tanstack/start-server-core@1.169.39` e
`@tanstack/react-start@1.168.60`.

A correção foi aplicada na versão que **não** exige Vite 8: `react-start`
1.169.x pede `vite >= 8`, e subir o bundler junto transformaria um patch de
segurança numa migração de build.

| Pacote                        | Antes    | Depois       |
| ----------------------------- | -------- | ------------ |
| `@tanstack/react-start`       | 1.168.18 | **1.168.60** |
| `@tanstack/start-server-core` | 1.169.8  | **1.169.39** |
| `seroval`                     | 1.5.4    | **1.7.3**    |
| `zod`                         | 3.25.76  | **4.6.7**    |
| `vitest`                      | 3.2.7    | **4.1.12**   |
| `drizzle-kit`                 | 0.18.1   | **0.31.11**  |
| `vite`                        | 7.3.3    | 7.3.7        |

**Restam 4 moderadas, todas em `drizzle-kit`** — ferramenta de desenvolvimento
que não é empacotada na aplicação. Não há caminho de correção sem trocar a
ferramenta.

### Corrigido no caminho

1. **Módulo duplicado partia os tipos.** `react-router@1.170.46` convivia com a
   cópia interna de `react-start@1.168.60` (1.170.41), o que gerava dois
   `router-core` na árvore — e **dois módulos distintos não compartilham module
   augmentation**. Efeito: `server.handlers` deixou de existir para o
   compilador em todas as rotas de API. Fixar `react-router` em `1.170.41`
   resolveu 12 dos 13 erros.
2. **`ErrorComponent` com tipo honesto.** O router tipa o erro capturado como
   `unknown`. Ler `error.message` direto quebraria dentro do próprio limite de
   erro — o único lugar que não pode falhar. Agora há `describeError`.
3. **`package-lock.json` dessincronizado do `package.json`.** O
   `drizzle-orm`/`drizzle-kit`/`postgres` entraram no manifest sem entrar no
   lock, e o npm 10 passou a falhar com `Cannot read properties of null` em
   qualquer instalação. Regenerado com npm 11.

### Lint: 2.127 erros para 111

O `npm run lint` falhava há muito tempo, e isso o tornava inútil como portão.
Duas causas: `types.ts` e `previewAuthStorage.ts` são **gerados** — 2.007 dos
2.127 erros eram formatação de código que a próxima geração sobrescreve. Agora
esses arquivos são isentos, o resto foi formatado, e sobraram **111 `any`**
legados em `BrainContext` e tipos afins: dívida real, não disfarçada.

`brace-expansion` foi fixado em 1.1.21 via `overrides` — não há versão sem
correção na linha 1.x, e o lint roda em toda verificação.

## [1.7.1] — 2026-10-28

### Corrigido — aplicação quebrada por `.env` removido do versionamento

Sintoma no browser publicado:

```
Error: Missing Supabase environment variable(s): SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY
```

Causa: o commit `chore: saneamento de base` removeu o `.env` do repositório. O
cliente do Supabase resolve `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`
em **build time**, então sem o arquivo o bundle saiu sem as variáveis e todo
carregamento da página estourava ao criar o cliente.

Removi o arquivo por hábito — "versionar `.env` é como chave de service-role
vaza". O hábito está certo em geral e errado neste projeto. A chave em questão é
`anon` (papel verificado no JWT), que já vai para o navegador de qualquer usuário
por definição e só permite o que o RLS autorizar. Esconder essa chave não protege
nada e, neste caso, derrubou a aplicação.

### A proteção que falta, agora implementada

O risco real nunca foi o `.env` versionado em si, e sim uma `service_role` key
acabar dentro dele — essa ignora RLS por completo. `scripts/check-env.mjs` roda
antes de todo build e falha se encontrar uma chave privilegiada num arquivo
rastreado:

- decodifica o claim `role` de qualquer JWT presente e recusa `service_role`;
- reconhece o formato novo do Supabase (`sb_secret_`) além do JWT clássico;
- só considera arquivos **versionados** — um `.env.local` do desenvolvedor é
  assunto dele;
- não imprime nenhum valor, apenas arquivo, variável e tipo de chave.

`npm run build` e `npm run build:dev` agora passam pelo guarda.

### Verificado

| Verificação                             | Resultado            |
| --------------------------------------- | -------------------- |
| Guarda com o `.env` real (chave `anon`) | passa                |
| Guarda com `service_role` injetada      | **bloqueia**, exit 1 |
| Build completo                          | ✓ 11,41 s + 26,39 s  |
| URL do projeto no bundle client         | presente             |
| `service_role` no bundle client         | ausente              |

## [1.7.0] — 2026-10-28

### Adicionado — Relatório semanal em PDF

Item nº 6 do roadmap. O produto já mede; faltava o artefato que sai da tela.
Quem toca um pequeno negócio mostra número para sócio, cliente ou contador — e
abrir o celular na reunião não é mostrar nada.

```
POST /api/reports/weekly?workspaceId=…&format=pdf|csv
├── valida o Bearer token do usuário
├── lê com a sessão dele (RLS decide o que pode ver)
├── 7 dias vs. os 7 anteriores
└── PDF de uma página + CSV dos mesmos números
```

- **`weekly.ts`** (puro, 14 testes): soma de métricas, comparação entre janelas
  e as frases de leitura. Taxa é derivada, nunca somada — somar percentuais não
  produz percentual.
- **`layout.ts`** (puro, testado): paginação, quebra de linha e conteúdo, como
  uma lista de operações de desenho.
- **`render.ts`**: executa as operações com `pdf-lib`. Nenhuma decisão de layout.
- **`WeeklyReportCard`** em Analytics com download de PDF e CSV.

### Três decisões que valem registro

1. **A comparação é o produto.** Um relatório que lista totais sem "vs. semana
   anterior" é print de dashboard. A pergunta que faz alguém abrir o PDF é o que
   mudou.
2. **Sem comparação possível, sem número inventado.** Quando a semana anterior é
   zero, a variação aparece como "novo", não como "∞%" — que ninguém lê.
3. **Nada de e-mail ainda.** O card diz, com todas as letras, que o envio
   automático depende de um provedor transacional que não existe. Um botão que
   não faz nada seria pior que a ausência do botão.

### Corrigido no caminho — quatro bugs, três deles invisíveis em teste

1. **Texto longo vazava para fora da página, em silêncio.** O desenho não
   paginava por linha: um título de 10 mil caracteres era escrito abaixo da
   margem e simplesmente não existia no PDF. Nenhum erro, nenhum aviso.
2. **Sanitização agressiva comia o travessão.** O filtro cortava tudo acima de
   U+00FF, então `21/10 — 28/10` saía como `21/10 ? 28/10` em todo relatório.
   WinAnsi inclui o travessão (0x97) e o ponto médio (0xB7); agora só emoji e CJK
   são substituídos.
3. **`getClaims` lança exceção em vez de retornar erro.** Token inválido produzia
   **500 com a página de erro do framework em HTML** — status errado, e expondo
   que a falha foi no servidor. Agora é 401 com JSON.
4. **Node 20 sem WebSocket derrubava a rota.** `createClient` constrói o cliente
   Realtime na hora, e essa rota nunca usa Realtime. O mesmo contorno que os
   outros módulos já faziam foi aplicado aqui.

Os bugs 1 e 2 passaram por testes que geravam PDF real e verificavam que o
arquivo abria. O que faltava era testar a **camada de layout** — daí a
separação de `layout.ts`: paginação e conteúdo agora são verificáveis numa
estrutura de dados, antes de virar byte.

### Testes

**244 testes (era 217)** em 16 arquivos: +14 de dados, +8 de layout (incluindo
"nunca desenhar abaixo da margem inferior" e "o número de páginas prometido pelo
layout é o que o PDF tem") e +5 de render.

## [1.6.0] — 2026-10-28

### Adicionado — Trust OS com fonte externa verificável

Item nº 5 do roadmap. A versão anterior do Trust OS pedia que o usuário
descrevesse o alvo em texto livre e entregava esse texto a um modelo, que
devolvia um `risk_score`. O problema é estrutural, não de prompt: **o modelo só
podia repetir o que o usuário já acreditava.** Ele não sabe se um CNPJ existe,
se está ativo ou se um domínio foi registrado semana passada — mas responde com
confiança se for perguntado.

A ordem foi invertida:

```
CNPJ ──> BrasilAPI (Receita Federal) ─┐
                                       ├──> sinais com evidência ──> score
site ──> RDAP (Registro.br/.com) ─────┘        determinístico
```

Nenhum modelo participa do score. Qualquer pessoa pode refazer as duas consultas
e chegar ao mesmo número — e o dossiê traz o link para fazer exatamente isso.

- **`signals.ts`** (puro, 26 testes): validação de CNPJ **com dígito
  verificador** (módulo 11, os dois DVs), não regex; normalização de domínio com
  rejeição de IP e sinalização de hospedagem gratuita; e scoring com pesos
  explícitos.
- **`registry.server.ts`**: BrasilAPI + RDAP, com timeout de 8 s via
  `AbortController`, cache de 6 h e **cache negativo desativado para falhas**
  (uma queda momentânea é retentada na próxima visita).
- **`dossier.server.ts`**: orquestra as duas consultas em paralelo, converte os
  registros em sinais e calcula o veredito.
- **Aba "Dossiê"** em `/app/trust`, agora a primeira: veredito → evidência →
  registro bruto → suas anotações.

### A regra: "não consegui consultar" ≠ "é suspeito"

É a decisão mais importante desta rodada. Quando a BrasilAPI cai, o resultado é
`insufficient` — nunca `low`. O texto na tela diz, com essas palavras, que
ausência de dado não é prova de risco. Um produto sobre confiança que transforma
timeout em acusação é pior que não existir.

Também não há exagero no outro sentido: um único risco duro (CNPJ baixado,
domínio vencido, domínio com dias de vida) derruba o veredito para `low`. Bons
sinais não fazem média com um CNPJ morto.

### Corrigido no caminho — dois bugs que os testes com mock não pegariam

1. **BrasilAPI devolve 403 para requisição sem `User-Agent`.** O `fetch` do Node
   não envia UA por padrão, então todas as consultas reais voltavam 403 e o
   dossiê dizia "fonte fora do ar" — com 100% dos testes verdes. Só apareceu no
   smoke test contra a API de verdade. Corrigido com um UA identificando o
   cliente, que também é a coisa certa a fazer com uma API mantida por
   voluntários.
2. **Sinal de vencimento invertido.** Um único helper de diferença de datas era
   usado para "idade" (passado) e "expira em" (futuro), com sinais opostos. O
   resultado é que domínio vencido não gerava sinal nenhum — silêncio no caso
   mais grave. Separado em `daysSince` e `daysUntil`, com o motivo no comentário.

### Verificado contra as fontes reais

| Caso                                                      | Resultado                             |
| --------------------------------------------------------- | ------------------------------------- |
| Petrobras (CNPJ ativo desde 1966 + domínio de 1996)       | `high`, 100/100                       |
| CNPJ com DV válido mas inexistente (`99.999.999/9999-62`) | `low`, 10/100, sinal `cnpj.not-found` |
| Domínio não registrado                                    | `low`, 35/100                         |
| Fontes fora do ar                                         | `insufficient` + nota explícita       |

### Testes

**217 testes (era 169)** em 14 arquivos: +26 de sinais, +13 de registry (incluindo
"nunca transformar queda de rede em `not_found`" e "não cachear falha") e +9 de
dossiê ponta a ponta.

## [1.5.0] — 2026-10-28

### Adicionado — Coach de reescrita com IA verificada

Item nº 4 do roadmap. O diagnóstico determinístico já responde _o que_ está
errado e _por quê_. O que ele não faz é propor uma frase melhor na voz daquele
negócio específico — e é só isso que a IA recebe permissão para fazer.

**A invariante do produto: a IA sugere, o motor determinístico decide.**

```
rascunho ──> preflight (puro) ──> problemas diagnosticados
                                        │
                                        ▼
                            modelo propõe reescritas
                                        │
                                        ▼
                    rewrite-gate re-executa o motor puro
                                        │
              ┌─────────────────────────┴──────────────────────────┐
       problema citado sumiu?                       não → descarta
       apareceu um blocker novo?                    sim → descarta
       o score caiu?                                sim → descarta
                                        │
                                        ▼
                              sugestão exibida
```

O modelo **nunca** produz o score. Ele declara qual problema a proposta resolve —
e `rewrite-gate.ts` verifica a afirmação relendo o texto com o mesmo motor puro
que auditou o original. Uma reescrita que alega ter corrigido a abertura, mas
abre com "Oi gente" de novo, é jogada fora. Sem isso, o painel venderia uma
melhoria que o próprio motor não reconhece.

- **`rewrite-gate.ts`** (puro, 17 testes): `snapshotDraft`, `judgeRewrite`,
  `selectBestRewrites`, `coachableIssues`. Motivos de rejeição explícitos:
  `empty`, `unchanged`, `not_addressed`, `new_blocker`, `score_regressed`,
  `unknown_issue`.
- **`coach.server.ts`**: um único tool call estruturado por pedido, com os
  problemas já diagnosticados, os limites reais da plataforma e a voz da marca
  no prompt. O modelo é obrigado a escolher `addresses` dentro do enum dos ids
  que existem.
- **`coachDraftWithAI`**: throttle em memória (8/min por usuário). O caso real
  de abuso não é ataque distribuído, é um cliente preso em retry — e o limite diz
  isso em vez de fingir ser distribuído.
- **`CoachCard`**: só dispara por ação explícita. Cada sugestão mostra o score
  **da reescrita**, calculado pelo motor, não a autoavaliação do modelo.

### Degradação honesta

| Situação                    | O que o usuário vê                                                           |
| --------------------------- | ---------------------------------------------------------------------------- |
| Sem `LOVABLE_API_KEY`       | "A IA está desligada neste ambiente" + o diagnóstico determinístico completo |
| Modelo falha / 429          | "O diagnóstico acima continua válido"                                        |
| Modelo devolve lixo         | `all_rejected` — nenhuma sugestão                                            |
| Rascunho sem problemas      | Nenhuma chamada é feita (0 tokens gastos)                                    |
| Problema é `media.required` | Nunca oferece reescrita de texto — texto não cria imagem                     |

### Corrigido no caminho

- **Payload malformado derrubava a server fn.** Se o modelo devolvesse
  `rewrites` como string em vez de array, o `.filter` estourava e o erro aparecia
  como 500 numa tela sem relação com a falha. Agora o tipo é validado antes de
  qualquer acesso (`Array.isArray` + guard de forma).

### Testes

**169 testes (era 143)** em 11 arquivos: +17 no gate de reescrita e +9 no coach,
usando um gateway falso que devolve exatamente o output errado que um LLM
devolve — opener fraco mantido, issue inventada, legenda acima do limite,
payload malformado. O objetivo desses testes não é provar que o modelo funciona.
É provar que o produto é seguro quando ele falha.

## [1.4.0] — 2026-10-28

### Adicionado — Link na bio e página pública

Item nº 3 do roadmap. É a **primeira superfície anônima** do produto: até aqui,
tudo passava por `auth.uid()` e RLS. Uma página pública não tem usuário — o que
obriga a mover o isolamento do _acesso_ para o _dado_.

- **Migration 17** (`bio_pages`, `bio_links`, `bio_link_clicks`), com RLS de
  membro para leitura/escrita autenticada e **nenhuma policy para `anon`**
  (`revoke all`). A página pública não é lida pelo cliente: é lida pelo servidor
  com service-role e devolvida pronta.
- **`bio_register_view(slug)` / `bio_register_click(...)`** — contadores atômicos
  em SQL. `UPDATE ... SET view_count = view_count + 1` em JS perde eventos sob
  concorrência, e a página com pico de tráfego é exatamente a que mais precisa do
  número correto.
- **Validação pura** (`src/lib/bio/validate.ts`, 33 testes): normalização de
  slug, palavras reservadas, apenas `http`/`https`, bloqueio de `javascript:`,
  `data:`, URLs protocol-relative e credenciais embutidas
  (`https://banco.com@evil.io`), helpers de WhatsApp/e-mail/telefone e checagem
  de conteúdo.
- **Editor `/app/bio`** com verificação de disponibilidade do slug em tempo real
  (debounce de 450 ms), reordenação de links, publicar/despublicar e prévia de
  celular ao lado do formulário — o dono vê o título quebrando em quatro linhas
  enquanto digita, em vez de descobrir depois.
- **Rota pública `/bio/$slug`** renderizada no servidor, com meta tags e Open
  Graph. Views são contadas no loader (funciona sem JS e sem blocker).
- **Endpoint de clique `/bio/click/$linkId`**: 302 para o destino lido do banco
  **por id** — nunca da query string, que transformaria o domínio em open
  redirect. `Cache-Control: no-store` (um 302 em cache suprimiria todos os
  cliques seguintes) e `Referrer-Policy: no-referrer`.

### Privacidade por construção

`bio_link_clicks` guarda **apenas o host** do referrer e a **família** do device.
A URL completa do referrer e o user agent bruto são dado pessoal que o produto não
precisa ter para responder "de onde vêm os cliques".

### O que o smoke test provou

Com o PostgREST simulado no nível de rede, o caminho completo foi exercitado:

| Verificação                             | Resultado                             |
| --------------------------------------- | ------------------------------------- |
| Página publicada renderiza em SSR       | 2.366 bytes de HTML                   |
| Rascunho (`is_published = false`)       | `not_found`                           |
| Filtro `is_published=eq.true` na query  | ✅ aplicado                           |
| URL de destino aparece no HTML          | ❌ — só `/bio/click/{id}`             |
| Link inativo / inexistente              | sem redirect                          |
| `javascript:` gravado no banco          | sem redirect (defesa em profundidade) |
| Analytics guardam e-mail / URL completa | ❌ — só host e device                 |

### Corrigido no caminho

- **Service-role vazando para o bundle do navegador.** `themeFor` vivia em
  `public.server.ts`, e importá-la de um componente de cliente arrastou o módulo
  inteiro para `dist/client`. A chave nunca foi exposta (o env é vazio no
  browser), mas o código do cliente administrativo não tem nada a fazer ali. Temas
  e tipos passaram a viver em módulos puros (`theme.ts`, `types.ts`), e a
  verificação virou parte da checklist: `grep` por `SUPABASE_SERVICE_ROLE_KEY`
  em `dist/client` tem que voltar vazio.
- **Erro de infraestrutura virando 500 com detalhe técnico no HTML.** A primeira
  versão derrubava a rota e escrevia `Missing Supabase environment variable(s):
SUPABASE_SERVICE_ROLE_KEY` na página. Agora `loadBioPage` distingue
  `not_found` de `unavailable`, a mensagem fica só no log do servidor e a tela de
  indisponibilidade é `noindex`.
- **`throw new Response()` não funciona em server function** (falha no seroval,
  vira 500 genérico) nem no `beforeLoad`/loader deste router. O status HTTP para
  indisponibilidade fica 200 por construção; o estado é marcado por `noindex`,
  copy própria e botão de tentar novamente.

### Testes

**143 testes (era 97)** em 9 arquivos: +33 de validação da bio, +13 do caminho
público (draft invisível, slug malformado sem tocar o banco, referrer reduzido a
host, link inativo, protocolo perigoso, contador falhando sem quebrar o redirect).

## [1.3.0] — 2026-10-28

### Adicionado — Google Business Profile

Item nº 2 do roadmap. No benchmark de 2026, entre Buffer, Later, Hootsuite e
Metricool, **só o Metricool** agenda no Google Business Profile — e para o
público do VELT (negócio local) a descoberta começa no Google, não no feed.

- **`social_platform` + `google_business`** (migration 16).
- **Provider OAuth** com escopo `business.manage`, reutilizando o client Google
  do YouTube. Inclui **discovery de locations** (accounts.list → locations.list).
- **Publisher** na API v4 `localPosts`: valida os três campos que o Google exige
  (`languageCode`, `summary`, `callToAction`), classifica o post em
  `STANDARD`/`OFFER`/`EVENT` a partir da copy, resolve o CTA (link explícito →
  link no texto → Maps) e trata 403 como não-retentável com diagnóstico.
- **`gbp.functions.ts`**: lista e vincula a unidade. A validação é server-side —
  um usuário não consegue apontar o canal para a loja de outra pessoa informando
  um id.
- **`BusinessLocationPicker`**: um card por loja, com endereço, status de
  verificação e ação explícita. Unidades não verificadas aparecem desabilitadas
  (esconder faria o usuário achar que a loja "sumiu").
- **Regras de plataforma**: legenda 1.500, mínimo 720×540, estratégia de busca.

### Por que não publicar automaticamente na primeira unidade

O callback escolhe a primeira loja como conveniência, mas o vínculo definitivo é
sempre do usuário: uma conta empresarial pode ter dezenas de unidades e um post
local é visível para clientes reais daquela loja. Publicar na loja errada não é
bug cosmético, é erro de negócio.

### Testes

- 97 testes (era 84): 13 novos cobrindo o publisher do Google Business —
  endpoint, campos obrigatórios, derivação de CTA, classificação de tipo de post,
  anexo de mídia, 403 vs 500 no contrato de retentativa e parsing de `external_id`.

## [1.2.0] — 2026-10-28

### Adicionado — coleta de métricas (fecha o loop)

Até aqui `analytics_snapshots` nunca era populado: o melhor horário rodava em
baseline para sempre e o motor de crescimento do Brain não enxergava tendência.

- **`analytics/normalize.ts`**: tradução de métricas de Instagram, Facebook,
  YouTube e LinkedIn para uma forma canônica comparável (`impressions`, `reach`,
  `engagement`, `engagement_rate`…). Sem isso, gráficos e motores comparariam
  unidades diferentes.
- **`analytics/insights.server.ts`**: coletores por plataforma com distinção
  explícita entre erro de credencial (operator precisa agir) e rate limit
  (basta esperar o próximo ciclo).
- **`analytics/sync.server.ts`**: orquestrador idempotente — um snapshot por post
  por dia; contadores cumulativos são mesclados por `max`, nunca somados.
- **`api/public/cron/analytics-sync.ts`**: endpoint com o mesmo gate do
  scheduler-tick (header compartilhado, comparação em tempo constante).
- **Migration 15**: agenda pg_cron a cada 6h + view `velt_metrics_health` para
  diagnóstico de "por que meu gráfico está vazio".
- **UI**: painel `SyncMetricsPanel` na tela de Analytics — dispara a coleta sob
  demanda e **explica sempre** por que não há dados, em vez de só mostrar vazio.

### Alterado

- Motor de crescimento do Brain agora consome `analytics_snapshots` reais:
  melhor horário sai de `baseline` para `observed`, e a taxa de engajamento
  medida gera sinal e ação (ex.: "reescrever o gancho").
- `getMetricsReadiness` responde com uma frase explicando a causa quando não há
  dado — vazio silencioso é a forma mais rápida de perder confiança no produto.

### Testes

- 84 testes (era 65): normalização das cinco plataformas, merge cumulativo,
  proteção contra provedor reportando zero, e o encadeamento métrica → Brain.

## [1.1.0] — 2026-10-28

### Adicionado — motor de crescimento

- **`lib/growth/platform-rules.ts`**: fonte única de verdade para 8 plataformas
  (legenda, hashtags ideais e máximas, mídia obrigatória, proporções, janelas
  de horário, link clicável). Elimina a divergência que existia entre o enum do
  banco (5), o publisher (8) e o formulário do Navegador (9).
- **`lib/growth/post-quality.ts`**: pré-voo de conteúdo (bloqueadores, avisos,
  dicas com causa e correção), análise de gancho, prontidão para anúncio pago e
  reescritas determinísticas — sem LLM, instantâneo, testado.
- **`lib/growth/scheduling.ts`**: melhor horário por engajamento **medido da
  própria conta**, com normalização por impressões, decaimento por espera e
  fallback explicitamente rotulado como `baseline`.
- **`lib/api/growth.functions.ts`**: server functions `preflightDraft`,
  `getBestTimeToPost`, `suggestPostHooks`, `getPublishCapabilities`.
- **UI**: `PreflightPanel` no compositor (análise ao vivo), `BestTimeCard` e
  `PublishCapabilityStrip` no agendador.

### Adicionado — publicação real

Substitui `stubPublish`, que retornava IDs sintéticos para todas as plataformas:

- **Instagram**: protocolo container → poll → publish (3 passos).
- **Facebook Page**: photo / video / feed por tipo de mídia.
- **YouTube**: upload resumível com download do asset e guarda de tamanho.
- **LinkedIn**: Posts API versionada com upload de imagem.
- **TikTok**: Content Posting API com modo rascunho por padrão.
- **`oauth/refresh.server.ts`**: refresh de token em tempo de execução, por
  provedor. Corrige a falha estrutural de jobs agendados semanas à frente.
- **`scheduler/media.ts`**: pré-checagem de mídia antes de gastar rede.
- **`scheduler/contracts.ts`**: tipos extraídos para eliminar acoplamento
  circular entre registry e implementações.
- **`VELT_PUBLISHER_MODE=simulate`**: modo de desenvolvimento explícito e
  ruidoso; nunca silencioso.

### Corrigido

- **SSR 500 em todas as rotas autenticadas.** `@supabase/realtime-js` lança
  durante a construção do cliente em runtimes sem WebSocket nativo (Node < 22).
  Agora o transporte `ws` é fornecido na construção, com fallback inerte.
- 3.670 → 123 problemas de lint (restam `any` de fronteira de dados, rastreados).
- Dependências circulares e `catch {}` silenciosos documentados ou removidos.
- Landing anunciava "RAG vetorial" e "pgvector", que não existem no schema.
  Copy corrigida para o que de fato entrega.
- Strings pt-BR fixas na landing agora passam por i18n.
- `.env` removido do versionamento; adicionado `.env.example` documentado.
- `.gitignore` não ignorava `.env`.

### Alterado

- Motor de crescimento do Brain enriquecido: consciência de cadência sustentável,
  rascunhos com impedimento e taxa de sucesso de publicação.
- `vite.config.ts`: `allowedHosts` liberado para previews hospedados.
- `package.json`: nome `velt`, scripts `test`/`typecheck`/`verify`.
- README reescrito — antes era o placeholder "Creative Canvas / crie uma
  plataforma web".

### Testes

- 65 testes (era 0): regras de plataforma, pré-voo, gancho, timezone, slots,
  decaimento, mídia, legenda, refresh de token e motores do Brain.
