
# USE Brain — Arquitetura

Transformar os módulos em **camada de apresentação** e centralizar toda a inteligência em um único motor: **USE Brain**. Os módulos param de calcular score, gerar recomendações, ranquear oportunidades — eles apenas consultam o Brain.

## Princípios

1. **Brain é a única fonte de verdade** para decisões, scores, recomendações e prioridades.
2. **Memória persistente** — toda decisão e resultado vira input das próximas respostas.
3. **Começa com regras + pontuações** (Nível 1). IA contextual entra depois.
4. **Cinco perguntas canônicas**: onde estou, onde quero chegar, o que me impede, próxima ação, vale mudar de direção?

## Arquitetura em camadas

```text
┌─ Camada 1: Interface ─────────────────────────────────┐
│ Dashboard · Opportunities · Coach · Health · Score   │
│ Content · Brands · Channels · Analytics · Learning   │
│         (apenas exibem o que o Brain responde)        │
└──────────────────┬────────────────────────────────────┘
                   │ brain.ask({ question, context })
                   ▼
┌─ Camada 2: USE Brain (orchestrator) ──────────────────┐
│  brain.snapshot(ws)  ──► estado consolidado           │
│  brain.ask(question) ──► 5 perguntas canônicas        │
│  brain.recommend()   ──► próximos passos rankeados    │
│  brain.remember(evt) ──► registra na memória          │
└──────────────────┬────────────────────────────────────┘
                   │
   ┌───────────────┼───────────────┬───────────────┐
   ▼               ▼               ▼               ▼
 User Eng.    Business Eng.   Market Eng.    Trust Eng.
 Growth Eng.  Opportunity Eng.
                   │
                   ▼
┌─ Camada 3: Memory ────────────────────────────────────┐
│ brain_memory_events (decisão, resultado, mudança)    │
│ brain_snapshots (estado periódico do negócio)        │
└───────────────────────────────────────────────────────┘
```

## Migração de banco (Fase Brain-1)

Novas tabelas:

- **brain_memory_events** — `(id, user_id, workspace_id, kind: decision|result|pivot|signal|reflection, subject, payload jsonb, sentiment, created_at)`. RLS por workspace + user.
- **brain_snapshots** — `(id, workspace_id, snapshot jsonb, scores jsonb, signals jsonb, computed_at)`. Snapshot consolidado.
- **brain_answers** — `(id, workspace_id, question: where_am_i|where_to_go|whats_blocking|next_action|should_pivot, answer jsonb, confidence, computed_at, expires_at)`. Cache das 5 perguntas.

RLS: leitura por membros do workspace; eventos do usuário restritos ao próprio user_id também.

## Motores (Camada 2)

Arquivos em `src/lib/brain/engines/`:

1. **user.engine.ts** — lê `user_profile_digital` + `profiles`. Deriva perfil cognitivo: nível, tempo, dinheiro, tolerância à complexidade.
2. **business.engine.ts** — lê `workspaces`, `brands`, `channels`. Deriva estágio, tipo de negócio, canais prioritários.
3. **market.engine.ts** — lê `opportunities`. Cruza com perfil do usuário para filtrar relevância (não mostra LinkedIn pra negócio local).
4. **growth.engine.ts** — lê `scheduler_jobs`, `content`, `analytics_snapshots`. Detecta queda de consistência, estagnação.
5. **opportunity.engine.ts** — combina market + user + business para rankear oportunidades **compatíveis**, não genéricas.
6. **trust.engine.ts** — placeholder estrutural (sem fonte externa ainda). Avalia confiabilidade de integrações conectadas.

Cada engine exporta `analyze(ctx: BrainContext): EngineReport` — função pura sobre o snapshot.

## Orquestrador

`src/lib/brain/brain.ts` (server-only helpers) + `src/lib/api/brain-core.functions.ts` (RPC).

```typescript
// Server fns expostas
brainSnapshot({ workspaceId })            // computa + persiste snapshot
brainAsk({ workspaceId, question })       // responde 1 das 5 perguntas
brainRecommend({ workspaceId })           // gera coach_recommendations via engines
brainRemember({ workspaceId, event })     // registra evento na memória
brainTimeline({ workspaceId })            // memória cronológica (decisões/resultados/pivots)
```

Pipeline interno de `brainSnapshot`:

```text
load(profile, workspace, brands, channels, content, jobs, analytics, opportunities, memory)
  → run all engines in parallel
  → merge into BrainContext { user, business, market, growth, opportunity, trust, memory }
  → derive scores, signals, blockers, next_actions
  → persist brain_snapshots
  → invalidate brain_answers (so next ask() recomputes)
```

Pipeline de `brainAsk`:

```text
get latest snapshot (or compute) 
  → router por questão:
    where_am_i      → resumo de scores + maturidade
    where_to_go     → goals do user_profile + missions abertas
    whats_blocking  → top 3 signals negativos (de growth + business + user)
    next_action     → 1ª recomendação rankeada (com link e justificativa)
    should_pivot    → compara memory.pivots passadas vs sinais atuais
  → cache em brain_answers (TTL 1h)
```

## Memória (o diferencial)

`brainRemember` recebe eventos como:
- `decision`: usuário marcou recomendação como completa
- `result`: job publicado / mission concluída / score subiu/desceu
- `pivot`: usuário mudou business_path no Navigator
- `signal`: motor detectou padrão (ex: "abandono de afiliados")
- `reflection`: nota livre do coach

Hooks já existentes (`updateRecommendation`, `enqueue_publication` via domain_events, save do Navigator) passam a chamar `brainRemember` para registrar a história.

`brainTimeline` retorna a memória cronológica para o Coach e para `should_pivot`:

> "Em janeiro você tentou afiliados e abandonou. Antes de voltar, considere: tempo disponível dobrou, mas competição no nicho subiu."

## Refatoração dos módulos (Camada 1)

Os módulos não somem — viram views finas:

- **`app.index.tsx` (Business GPS)** — passa a chamar `brainAsk` para cada um dos 5 cards (Onde estou, Onde quero, O que me impede, Próxima ação, Mudar direção?).
- **`app.coach.tsx`** — `generateRecommendations` deprecia em favor de `brainRecommend`. UI igual.
- **`app.score.tsx`** — lê `digital_scores` mas via `brainSnapshot` (que persiste lá).
- **`app.health.tsx`** — idem (health_metrics escritos pelo Brain).
- **`app.opportunities.tsx`** — passa a chamar `brainOpportunities` que filtra/rankeia por compatibilidade.
- **`app.navigator.tsx`** — `saveDigitalProfile` dispara `brainRemember({kind:'pivot'})` + `brainSnapshot`.

Wrappers antigos (`coach.functions.ts`, `score.functions.ts`, `health.functions.ts`) ficam como façades finas que chamam o Brain (compatibilidade sem quebrar imports).

## Service layer

Novo: `src/lib/services/brain.service.ts` exportando `BrainService.snapshot/ask/recommend/remember/timeline`.

## Realtime

Channel novo em Supabase Realtime: `brain_snapshots` + `brain_answers`. Quando o Brain recomputa, o Dashboard atualiza sem refresh.

## Fases de entrega (esta turn)

**Brain-1** (esta turn):
1. Migration: `brain_memory_events`, `brain_snapshots`, `brain_answers`, enum `brain_question`, `brain_event_kind`.
2. Engines (6 arquivos puros em `src/lib/brain/engines/`).
3. Orquestrador `src/lib/brain/brain.ts` + `brain-core.functions.ts`.
4. Service `brain.service.ts`.
5. Refatorar `app.index.tsx` para usar `brainAsk` nas 5 perguntas (mantendo Score gauge + Health no topo).
6. `saveDigitalProfile` e `updateRecommendation` passam a chamar `brainRemember`.

**Brain-2** (próxima turn, sob aprovação):
- Migrar Coach/Score/Health/Opportunities para façades do Brain.
- UI de memória/timeline em `/app/coach` ("Sua jornada").
- Realtime push.

**Brain-3** (futuro):
- Nível 2: IA contextual via Lovable AI Gateway dentro dos engines (Gemini 2.5 Flash para reflexões, Pro para should_pivot).
- Trust Engine com fontes externas.
- Inteligência preditiva.

## Segurança

- Todos os server fns sob `requireSupabaseAuth`.
- RLS workspace-scoped em todas as 3 tabelas novas.
- `brain_memory_events.user_id` restringido ao próprio usuário para eventos pessoais; eventos de workspace (results, signals) visíveis a membros.
- Zod em todos os inputs.

## Resposta esperada

Confirmação para executar **Brain-1**. Se quiser ajustar ordem (ex: priorizar Brain-2 sobre refator do Dashboard) me diga antes de eu rodar a migration.
