## USE OS — The Operating System for Digital Growth

This is a very large, multi-phase build. The existing project already has significant USE OS scaffolding: workspaces, brands, channels, content, scheduler, brain, missions, analytics, auth, RLS, server functions, and Portuguese routes under `/app/*`. To avoid a 4-hour single-shot rebuild that risks breaking the working app, I propose **incremental delivery in phases**, starting with the highest-impact foundation pieces.

---

### What already exists (verified from prior turns)

- ✅ Auth (login/signup/Google OAuth), `_authenticated` guard, profiles, onboarding
- ✅ Multi-tenant workspaces + `workspace_members` with RBAC (owner/admin/editor/viewer)
- ✅ Domain modules: brands, channels, content, scheduler, missions, brain, analytics, settings
- ✅ Server functions with `requireSupabaseAuth` + `assertWorkspaceMember` (defense in depth)
- ✅ RLS policies, OAuth flow, cron endpoint, audit logs, domain events
- ✅ Tailwind + shadcn/ui, dark mode tokens in `src/styles.css`
- ✅ pt-BR strings (hardcoded in components)

### What's missing / needs upgrade for "USE OS" vision

1. **i18n architecture** — currently hardcoded pt-BR. Need full i18next setup with 16 languages + RTL.
2. **Premium Command Center dashboard** — current dashboard is basic; needs KPI grid, activity feed, AI insights, alerts, mission progress, realtime.
3. **Premium design identity** — needs unique "USE OS" brand tokens (gradient system, elevation, motion presets), polished sidebar/topbar, language switcher.
4. **Framer Motion micro-interactions** — page transitions, card hover, nav transitions.
5. **Onboarding wizard** — guided multi-step workspace/brand/channel setup.
6. **Service-layer abstraction** — currently server fns call Supabase directly; need a thin interface boundary so future Python/FastAPI backend can plug in.

---

### Phased delivery

I'll ship this in **3 phases**, each independently shippable. This message covers **Phase 1** — request the next phase when ready.

### Phase 1 — Foundation (this turn)

**Scope:** i18n + design identity + Command Center + language switcher. ~10–12 files, no DB changes.

1. **i18n architecture**
   - Install `i18next`, `react-i18next`, `i18next-browser-languagedetector`.
   - Create `src/config/i18n.ts` with namespace-based loader.
   - Create `src/locales/{pt-BR,en,es,fr,de,it,ja,zh-CN,ko,ru,ar,hi,tr,nl,pl,sv}/common.json` with shared keys (nav, actions, states, dashboard).
   - Full translations for **pt-BR** and **en** (default + fallback). Other 14 languages get a minimal seed (nav + common actions) — expandable later without architectural change. RTL flag for `ar`.
   - Wire `I18nProvider` in `__root.tsx`, persist choice in `localStorage` + `profiles.locale`.

2. **USE OS design identity**
   - Update `src/styles.css` with USE OS brand tokens: deep indigo/violet primary with electric accent, refined neutrals, gradient-primary, gradient-subtle, shadow-elegant, shadow-glow, motion easings.
   - Add Framer Motion page transition wrapper.

3. **Premium Command Center** (`/app` index dashboard)
   - KPI grid (4 cards: published, scheduled, engagement, AI score)
   - Activity feed (from `domain_events`)
   - AI recommendations panel (from `brain_recommendations`)
   - Upcoming publications (from `scheduler_jobs`)
   - Mission progress (from `missions`)
   - System health strip
   - All wired to existing server functions; realtime subscriptions on `domain_events`.

4. **Language switcher UI** in topbar + settings.

5. **Service-layer boundary**: introduce `src/lib/services/` with typed interfaces (`ContentService`, `SchedulerService`, etc.) that today wrap server fns and tomorrow can swap to a Python backend without component changes.

### Phase 2 (next turn, on request)

- Premium onboarding wizard (workspace → brand → channels → first mission)
- Polished sidebar/topbar with animations, workspace switcher refresh
- Notifications center
- Settings overhaul (team management, role assignment UI, locale, theme persistence)

### Phase 3 (next turn, on request)

- Per-module premium UI passes (content editor, scheduler calendar, analytics charts, brain center)
- Page transitions across all routes
- Empty states / loading states / error states polish per route
- RTL QA pass

---

### Technical notes

- **No DB migrations in Phase 1** — schema already supports everything needed.
- **No breaking changes** — additive only. Existing routes keep working.
- **Service layer** is a thin re-export wrapper, zero runtime cost, future-proofs for backend swap.
- **i18n seed strategy**: pt-BR + en full, others stub with English fallback. Real translations are a content task, not architecture.

Confirm to proceed with **Phase 1**, or tell me to reorder/reduce scope.
