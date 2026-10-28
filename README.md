# VELT

**Um sistema operacional para a presença digital de quem está começando.**

VELT conecta os canais de um pequeno negócio (Instagram, Facebook, YouTube, TikTok, LinkedIn), agenda e publica conteúdo, mede o resultado — e transforma tudo isso em decisão: _onde eu estou, onde quero chegar, o que me impede, qual a próxima ação, vale mudar de direção?_

O diferencial não é ser mais um agendador de posts. É ser a camada de **julgamento**: o produto audita cada publicação antes dela ir ao ar, aprende com o histórico da própria conta e mantém memória das decisões tomadas.

---

## Estado atual, sem marketing

| Área                                                   | Situação                                   |
| ------------------------------------------------------ | ------------------------------------------ |
| Multi-tenant com RLS por workspace                     | ✅ Produção                                |
| UI completa — 23 telas, i18n pt-BR/en-US               | ✅ Produção                                |
| USE Brain (6 engines, 5 perguntas, memória)            | ✅ Nível 1 — regras determinísticas        |
| Motor de crescimento (pré-voo, gancho, melhor horário) | ✅ Produção                                |
| Publicação Instagram / Facebook / YouTube              | ✅ Implementada (requer credenciais OAuth) |
| Publicação LinkedIn / TikTok                           | ✅ Implementada (vídeo LinkedIn ainda não) |
| Publicação Google Business Profile                     | ✅ Implementada + seletor de loja          |
| Link na bio + página pública                           | ✅ Produção — `/bio/{slug}`, SSR + SEO     |
| X, Threads, Pinterest                                  | ⛔ Sem publisher — falha explícita         |
| Commerce Hub                                           | ⛔ Casca — "em breve"                      |
| IA generativa no Brain                                 | ⚠️ Opcional, requer `LOVABLE_API_KEY`      |
| Coach de reescrita com IA verificada                    | ✅ Com IA ou fallback determinístico       |
| Trust OS com fonte externa (CNPJ + domínio)             | ✅ BrasilAPI + RDAP, sem chave             |
| Relatório semanal em PDF + CSV                          | ✅ Sob demanda, autenticado                |
| Busca vetorial / RAG                                   | ⛔ Não implementado (removido da landing)  |

A honestidade é um requisito de produto: a tela de Agendamento mostra, canal por canal, o que realmente está habilitado naquele ambiente (`VELT_PUBLISHER_MODE`, credenciais presentes). Nenhum job entra em fila prometendo publicar o que não publica.

---

## Começando

```bash
git clone https://github.com/Implantac/cozy-hub-platform.git
cd cozy-hub-platform
cp .env.example .env      # preencha as chaves
npm install
npm run dev               # http://localhost:8080
```

O `.env` **é versionado neste projeto** e isso é intencional: o cliente Vite
resolve as variáveis do Supabase em tempo de build, então sem o arquivo o bundle
publicado sobe sem configuração e quebra no navegador. A chave contida nele é
`anon`, pública por design.

O risco real é uma `service_role` acabar dentro desse arquivo — ela ignora RLS.
`npm run build` executa `scripts/check-env.mjs`, que decodifica o `role` de
qualquer JWT em arquivo versionado e falha se encontrar uma chave privilegiada.
Chaves de servidor (`SUPABASE_SERVICE_ROLE_KEY`, `OAUTH_TOKEN_ENC_KEY`, segredos
de OAuth) ficam no ambiente de deploy, nunca no repositório.

Requisitos: **Node 22+** (recomendado) ou Node 20 com a dependência `ws` já incluída. O projeto declara engine `>=20` para não quebrar CI antigo, mas o Supabase Realtime só usa WebSocket nativo a partir do Node 22 — o client já resolve isso via transporte `ws`.

### Scripts

```bash
npm run dev         # servidor de desenvolvimento
npm run build       # build de produção
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run test        # vitest (244 testes)
npm run verify      # typecheck + lint + test + build
```

---

## Como o sistema pensa

```
Camada 1 — Interface (22 telas)
        │  pergunta ao Brain, nunca calcula sozinha
        ▼
Camada 2 — USE Brain (orquestrador)
        │  snapshot · ask · recommend · remember · timeline
        ▼
   6 engines puras: user · business · market · growth · opportunity · trust
        │
        ▼
Camada 3 — Memória (brain_memory_events · brain_snapshots · brain_answers)
```

E, em paralelo, o **motor de crescimento**, que é determinístico e roda em milissegundos:

| Módulo                     | O que faz                                                                                                  | Onde          |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------- |
| `growth/platform-rules.ts` | Fonte única de verdade dos limites por plataforma: legenda, hashtags, mídia, proporção, janelas de horário | 8 plataformas |
| `growth/post-quality.ts`   | Pré-voo (bloqueadores/avisos), análise de gancho, prontidão para anúncio, reescritas sugeridas             | puro, testado |
| `growth/scheduling.ts`     | Melhor horário por engajamento **medido da própria conta**, com decaimento por espera e fallback honesto   | puro, testado |

### O loop fechado

```
conecta ──> pré-voo ──> agenda ──> publica na API real (5 redes + Google Business)
                                        │
                     memória <── Brain <── métricas medidas
```

O elo de medição (`lib/analytics/`) roda a cada 6h via pg_cron e sob demanda
("Medir agora"). Sem ele, o melhor horário ficaria em baseline para sempre e o
Brain não veria tendência nenhuma — foi o primeiro item do roadmap por isso.

### Por que "decay por espera" importa

Um algoritmo ingênuo responde "publique quinta às 19h" mesmo quando hoje é sexta e existe um horário razoável amanhã. O usuário ignora — e com razão. O motor multiplica a qualidade do slot por `0.92^dias_de_espera`, então uma janela só vale a pena se for realmente melhor. A recomendação sempre declara a fonte: `observed` (seus dados) ou `baseline` (padrão da plataforma).

---

## Pré-voo de conteúdo

Toda publicação passa por uma auditoria antes de entrar na fila:

- **Bloqueadores** (a publicação falharia na API): legenda acima do limite, mídia obrigatória ausente, título longo, plataforma sem publisher.
- **Avisos** (perde alcance): hashtags fora da faixa ideal, link em plataforma que não aceita link, gancho fraco ou longo demais.
- **Dicas**: parede de texto, emoji em excesso, "você sabia que…".

Cada achado traz **por que** e **como corrigir**. Nada é um número solto.

---

## Publicação

`src/lib/scheduler/publishers/` implementa as APIs reais:

- **Instagram** — container → poll de status → publish (o protocolo de 3 passos que a maioria das integrações erra).
- **Facebook Page** — photo / video / feed por tipo de mídia.
- **YouTube** — sessão de upload resumível, com baixa do asset e guarda de tamanho.
- **LinkedIn** — Posts API versionada (`LinkedIn-Version`), upload de imagem incluso.
- **TikTok** — Content Posting API; padrão em modo rascunho (`inbox`), direto apenas com app aprovada.
- **Google Business Profile** — API v4 `localPosts`. Exige `languageCode` + `summary`
  - `callToAction` (o Google não diz qual campo faltou); classifica o post em
    `STANDARD` / `OFFER` / `EVENT` a partir da copy; imagem precisa ser ≥ 720×540.

Camada de suporte:

- **Refresh de token em tempo de execução** (`oauth/refresh.server.ts`). Um post agendado para três semanas à frente quase nunca tem token válido na hora de publicar. Estratégia por provedor: `refresh_token` grant (Google, LinkedIn, TikTok) e troca por long-lived token (Meta).
- **Pré-checagem de mídia** (`scheduler/media.ts`): HTTPS público, formato identificável, vídeo onde só cabe imagem.
- **Erros normalizados** em `retryable` — o que não pode ser corrigido por retentativa vai direto para a dead letter queue, com motivo legível.

Para desenvolvimento sem credenciais:

```bash
VELT_PUBLISHER_MODE=simulate npm run dev   # nada é publicado; logs deixam isso óbvio
```

---

## Link na bio

A única superfície anônima do produto — e por isso a que exige mais cuidado.

```
/bio/{slug}        página pública (SSR, indexável)
/bio/click/{id}    302 + registro do clique
/app/bio           editor (slug, tema, links, publicar)
```

Três decisões que parecem detalhe e não são:

1. **`anon` não tem `SELECT` nas tabelas `bio_*`.** Sem sessão não existe policy
   possível. A leitura é server-side com service-role, filtrando
   `is_published = true` no mesmo `where`. Um rascunho não é "escondido no
   front": ele não sai do banco.
2. **O destino do clique vem do banco por `id`, nunca da query string.** Aceitar
   o alvo como parâmetro tornaria `/bio/click/{id}?to=...` um open redirect
   assinado pelo nosso domínio. O endpoint responde `no-store` (um 302 em cache
   suprimiria todos os cliques seguintes) e `Referrer-Policy: no-referrer`.
3. **Contadores são SQL, não JS.** `view_count = view_count + 1` lido e reescrito
   em JavaScript perde eventos sob concorrência — e a página com pico é
   justamente a que precisa do número certo.

Privacidade: `bio_link_clicks` guarda **só o host** do referrer e a **família**
do device. Nem URL completa, nem user agent, nem IP.

---

## Coach de reescrita com IA

O diagnóstico é determinístico de propósito: roda em cada tecla, custa zero,
nunca inventa e pode ser testado. A IA entra depois, com uma permissão estreita —
propor uma frase melhor na voz daquele negócio.

**A regra: a IA sugere, o motor decide.** Toda proposta volta para o motor puro
antes de aparecer:

| Verificação | Reprovado se |
| --- | --- |
| O problema citado sumiu? | o texto ainda abre com "Oi gente" |
| Apareceu blocker novo? | passou do limite de caracteres da plataforma |
| O score caiu? | qualquer queda, mesmo de 1 ponto |

Sugestão reprovada é descartada, não exibida com ressalva. O modelo também nunca
escreve o número do score — ele não é juiz do próprio trabalho.

Sem `LOVABLE_API_KEY` o painel não quebra: mostra o diagnóstico determinístico
completo e diz que a camada de IA está desligada.

---

## Trust OS: confiança com fonte verificável

Antes: o usuário descrevia o alvo, um modelo devolvia um score de risco. O
modelo só podia repetir o que o usuário já cria — e não tem como saber se um
CNPJ existe.

Agora:

| Fonte | O que responde | Chave |
| --- | --- | --- |
| [BrasilAPI](https://brasilapi.com.br) | Situação cadastral, data de abertura, porte, sócios, capital | Nenhuma |
| [RDAP](https://rdap.org) | Registro e vencimento do domínio (Registro.br para `.br`) | Nenhuma |

O score é determinístico e cada sinal carrega a evidência e a fonte. O dossiê
inclui o link para refazer a consulta.

**A distinção que sustenta o produto:** fonte fora do ar produz `insufficient`,
nunca `low`. "Não consegui verificar" e "verifiquei e é ruim" são respostas
diferentes, e a segunda acusa alguém. Um único risco duro (CNPJ baixado, domínio
vencido) derruba o veredito: bons sinais não fazem média com empresa fechada.

O que só uma pessoa pode checar continua explícito: **nenhum registro público diz
qual CNPJ opera qual site.** O produto pede essa conferência em vez de fingir
que fez.

---

## Relatório semanal

`GET /api/reports/weekly?workspaceId=…&format=pdf|csv`, com o Bearer token do
usuário. Nada é armazenado: os bytes existem durante a requisição.

A comparação é o ponto. Sete dias contra os sete anteriores, com a variação ao
lado de cada número. Semanas sem base de comparação mostram "novo" em vez de uma
porcentagem infinita, e uma semana sem atividade diz isso — não desenha um
gráfico vazio.

O PDF é gerado por `pdf-lib` com fontes padrão (Helvetica cobre todo o pt-BR em
WinAnsi, verificado) e sem imagens externas: renderiza igual num servidor sem
rede e sem bucket. O CSV traz os mesmos números, para quem quiser conferir a
conta em vez de confiar no documento.

**Envio automático por e-mail não existe.** O card na tela diz isso. Depende de um
provedor transacional que ainda não está configurado.

---

## Testes

```bash
npm run test
```

244 testes cobrindo as partes em que um bug é invisível em produção: limites de plataforma, análise de gancho, timezone e slots, normalização por impressões, decaimento por espera, classificação de mídia, montagem de legenda, os motores do Brain, o contrato do Google Business e a exposição pública do link na bio (rascunho invisível, slug malformado, referrer reduzido a host, protocolo perigoso).

---

## Arquitetura de código

```
src/
├── routes/                 TanStack Start (file-based); 24 rotas autenticadas
├── features/<dominio>/     components · hooks · constants por domínio (22)
├── lib/
│   ├── api/                22 arquivos de server functions (auth + Zod)
│   ├── brain/              orquestrador + 6 engines puras
│   ├── growth/             motor de crescimento (puro + testado)
│   ├── scheduler/          dispatcher, publishers, mídia, contratos
│   ├── oauth/              providers, crypto, state, store, refresh
│   ├── bio/                validação pura · temas · leitura pública server-side
│   ├── analytics/          normalize · insights · sync (cron)
│   └── i18n/               pt-BR · en-US
└── components/             ui/ (shadcn) + app/
supabase/migrations/        17 migrations — schema, RLS, enums, RPCs, cron
```

Convenções que não devem ser quebradas:

1. **`*.server.ts`** = código que nunca pode vazar para o client (bundler recusa).
2. **Server functions**: sempre `requireSupabaseAuth` + validação Zod.
3. **Regras de plataforma** só em `growth/platform-rules.ts`. Nunca duplicar listas.
4. **Motores puros** não importam Supabase — recebem contexto, devolvem relatório. É o que os torna testáveis.

---

## Segurança

- RLS habilitada em todas as tabelas, escopo por workspace; eventos pessoais do Brain restritos ao próprio `user_id`.
- Tokens OAuth cifrados em repouso (AES-256-GCM, `OAUTH_TOKEN_ENC_KEY`).
- State de OAuth assinado por HMAC, com proteção contra injeção de host.
- `.env` versionado por necessidade de build (ver "Começando"). Guarda apenas a
  chave `anon`; o build falha se uma `service_role` aparecer ali.

---

## Débito conhecido

Rastreado, não escondido:

- ~110 `any` em fronteiras de dados (majoritariamente `brain/` e `dashboard/`). Tipagem progressiva planejada.
- Sem migrations para pgvector; a memória do Brain é textual.
- Métricas do TikTok ausentes: exige o escopo `video.list`, aprovado à parte.
- Posts do Google Business expiram em ~7 dias: a UI avisa, mas ainda não há
  lembrete automático de renovação.
- Commerce Hub sem implementação.
- Sem E2E (Playwright) — os testes cobrem lógica pura, não fluxo de UI.
- `/bio/{slug}` responde 200 quando o banco está inacessível (marcado `noindex`,
  com tela própria). O router não permite definir status por `throw new
  Response` nem no `beforeLoad`; corrigir exigiria uma rota de servidor crua.

---

Construído sobre TanStack Start, React 19, Tailwind 4, Supabase e Lovable.
