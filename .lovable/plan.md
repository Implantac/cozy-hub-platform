# USE OS → Digital Business Operating System

Plano de evolução em fases. Cada fase é incremental, não quebra o existente, e entrega valor visível. Vamos do núcleo (Navigator + GPS Dashboard + Score) para os módulos satélites.

## Princípio guia
Toda tela responde: **"Qual é a próxima melhor ação para crescer?"**
Onboarding → Diagnóstico → Recomendação → Execução → Medição → Repete.

---

## Fase A — Núcleo de Inteligência (fundação)

**1. Schema (migration)**
- `user_profile_digital` — experience_level, business_type, goals[], time_budget, money_budget, preferred_channels[], maturity_level, business_path, created_at
- `digital_scores` — workspace_id, overall, presence, branding, content, consistency, growth, channel_setup, computed_at, breakdown jsonb
- `opportunities` — workspace_id (nullable=global), title, niche, status (exploding/growing/stable/saturated/declining), difficulty, competition, growth_potential, actions jsonb, expires_at
- `learning_paths` + `learning_path_progress` — slug, title, milestones jsonb, user_id, completed_milestones[], progress_pct
- `health_metrics` — workspace_id, category (marketing/content/brand/channel/growth), score, strengths[], weaknesses[], computed_at
- `coach_recommendations` — workspace_id, kind (insight/warning/suggestion/next_action), title, body, cta jsonb, severity, dismissed_at
- RLS por workspace; GRANTs explícitos.

**2. Service layer** (`src/lib/services/`)
- `navigator.service.ts` · `score.service.ts` · `opportunities.service.ts` · `coach.service.ts` · `health.service.ts` · `learning.service.ts` · `commerce.service.ts`
- Cada um com `*.functions.ts` correspondente em `src/lib/api/`.
- Score calculado server-side (regras determinísticas baseadas em brands/channels/content/jobs/missions existentes).

---

## Fase B — Digital Navigator (onboarding inteligente)

Substitui o `OnboardingWizard` atual por fluxo de 6 passos:
1. Welcome + experiência (Beginner / Intermediate / Advanced)
2. Tipo de negócio (cards visuais: Local, Creator, Affiliate, Services, SaaS, Agency, Freelancer)
3. Objetivos (multi-select: primeiros clientes, audiência, lançar serviço, vender produto, etc.)
4. Tempo + orçamento (sliders)
5. Canais preferidos (chips com ícones)
6. Plano gerado — mostra: Perfil Digital, Nível de Maturidade, Caminho recomendado, **3 primeiras ações**

Persiste em `user_profile_digital` e dispara seed de `learning_paths` + `coach_recommendations` iniciais.

---

## Fase C — Business GPS Dashboard

Reescreve `app.index.tsx` como cockpit. Layout adaptativo:

```text
┌─────────────────────────────────────────────────┐
│ Digital Score (gauge grande) │ Business Health  │
├──────────────────────────────┴──────────────────┤
│ Current Goal + Progress  │  Next Best Actions   │
├──────────────────────────┼──────────────────────┤
│ Opportunities (3 cards)  │  Risks / Warnings    │
├──────────────────────────┴──────────────────────┤
│ Priority Tasks │ Recommendations │ Activity     │
└─────────────────────────────────────────────────┘
```

KPIs antigos viram cards menores no rodapé. Tudo orientado a *o que fazer agora*.

---

## Fase D — Módulos novos (rotas)

Cada rota com `PageTransition`, header padrão, empty states premium:

- `/app/navigator` — re-rodar/editar perfil digital + ver caminho atual
- `/app/score` — breakdown por categoria, gaps, "como subir cada pilar"
- `/app/opportunities` — Radar com filtros (status, nicho, dificuldade); cards com ações
- `/app/coach` — feed de recomendações (insight / warning / suggestion / next action), dismiss + "marcar feito"
- `/app/health` — 5 cards de saúde (marketing/content/brand/channel/growth) + forças/fraquezas
- `/app/learning` — trilhas guiadas com milestones e progresso
- `/app/commerce` — placeholder estruturado (suppliers, dropshipping, marketplaces, validation) — só arquitetura

---

## Fase E — Upgrades nos módulos existentes

- **Setup Assistant (`/app/channels`)** — checklist visual por plataforma (Connected / Incomplete / Needs Attention / Recommended) com guidance acionável
- **Business Builder** — novo wizard dentro de `/app/brands/$id` gerando posicionamento, proposta de valor, audiência, oferta, preço, bio, CTA (via Lovable AI Gateway)
- **Content OS (`/app/content`)** — adicionar workflow visual *Strategy → Content → Distribution → Optimization* + tipos novos (reel/short/story/carousel/caption/hashtag/cta)
- **Sidebar** — reagrupar nav em: **Comando** (Dashboard, Score, Health) · **Crescimento** (Navigator, Opportunities, Coach, Learning) · **Operação** (Brands, Channels, Content, Scheduler) · **Inteligência** (Brain, Analytics) · **Comércio** (Commerce)

---

## Fase F — Polish

- i18n pt-BR + en-US para todas as strings novas
- Empty states com CTA guiando para Navigator
- Motion: stagger nas listas, gauge animado no score
- Recomendações em tempo real via Supabase Realtime no `coach_recommendations`

---

## Detalhes técnicos

- **Stack:** TanStack Start + createServerFn + Supabase (Lovable Cloud) — sem Edge Functions
- **AI:** Lovable AI Gateway (`google/gemini-2.5-flash` para recomendações, `gemini-2.5-pro` para Business Builder) — já tem `LOVABLE_API_KEY`
- **Score engine:** função SQL `compute_digital_score(workspace_id)` + recalculo em `coach_recommendations` insert/update
- **Realtime:** publicar `coach_recommendations` e `digital_scores` no `supabase_realtime`
- **Sem quebrar nada:** rotas/serviços antigos permanecem; Dashboard antigo migra para `app.legacy.tsx` durante transição e some quando GPS estiver completo

---

## Ordem de execução proposta

1. **Migration** completa (Fase A) — uma só, com seeds de learning paths e opportunities globais
2. **Service + API layer** (Fase A)
3. **Digital Navigator** (Fase B) — substitui onboarding
4. **GPS Dashboard** (Fase C) — substitui home
5. **Score + Opportunities + Coach** (Fase D parte 1)
6. **Health + Learning + Commerce** (Fase D parte 2)
7. **Upgrades** (Fase E)
8. **Polish + i18n + Realtime** (Fase F)

Cada fase = 1 turno de implementação para revisar antes de continuar.

---

**Posso começar pela Fase A (migration + service layer)?** Ou prefere ajustar escopo / ordem antes?
