
## Diagnóstico (achados principais)

Base atual: ~4.7k LOC, 99 arquivos. Estrutura geral boa (TanStack Start, server fns, RLS, separação `lib/api` vs `lib/<domain>.server`). Problemas concretos encontrados:

1. **Violação de camada**: `PageHeader` é definido em `src/routes/_authenticated/app.brands.tsx` e importado por `app.channels.tsx`, `app.missions.tsx`, etc. Componente compartilhado morando em arquivo de rota.
2. **Boilerplate CRUD duplicado** em todas as páginas autenticadas (brands, channels, missions, content): mesmo padrão `useServerFn` + `useQuery({queryKey, queryFn, enabled: !!wsId})` + `useMutation({onSuccess: invalidate + toast, onError: toast})`.
3. **Tipos perdidos**: várias `(b: any)`, `(c: any)`, `(m: any)` em `.map(...)` — temos `Database["public"]["Tables"][...]["Row"]` disponível.
4. **Form/input inline**: cada rota repete `<input className="rounded-md border border-input bg-background px-3 py-2 text-sm" />` e botões idem, enquanto temos `@/components/ui/{input,button,textarea,select}` shadcn já instalados e não usados.
5. **Imports inconsistentes**: ordem variável (externos / internos / relativos misturados), múltiplos lucide-icons em uma única linha enorme em alguns arquivos.
6. **`channels.functions.ts` cria evento `domain_events` inline** — pequena regra de negócio dentro do server fn. OK manter, mas extrair um helper `recordDomainEvent()` reduz repetição (também usado em `enqueue_publication`).
7. **Workspace selector**: `useCurrentWorkspaceId()` é chamado em toda rota e cada uma trata `!wsId` à sua maneira — pode virar um `WorkspaceGate` no layout `app.tsx`.

## Plano de refatoração (7 passos, sem mudança funcional)

### 1. Extrair UI compartilhada para `src/components/app/`
- `src/components/app/PageHeader.tsx` (movido de `app.brands.tsx`)
- `src/components/app/EmptyState.tsx` (deduplicar "No X yet")
- `src/components/app/StatusBadge.tsx` (badges de status já repetidos em channels/scheduler)
- `src/components/app/PlatformIcon.tsx` (mapa `platform → ícone lucide`, usado em channels e scheduler)
- Atualizar imports em todas as rotas.

### 2. Hooks CRUD genéricos em `src/lib/query/`
- `useWorkspaceQuery(key, fn, opts?)` — encapsula `enabled: !!wsId` + injeta `workspaceId`.
- `useWorkspaceMutation(fn, { invalidate, successMsg, errorMsg? })` — encapsula `invalidateQueries` + `toast.success/error`.
- Migrar brands, channels, missions, content para usá-los. Reduz cada página em ~30 linhas e elimina pontos de erro (esquecer invalidate, mensagens inconsistentes).

### 3. Substituir inputs/botões inline pelos componentes shadcn
- Trocar `<input className="rounded-md…" />` por `<Input />`
- Trocar `<button className="…bg-primary…">` por `<Button />` (variantes default/outline/destructive)
- Trocar `<select>` por `<Select>` do shadcn nas páginas de criação (brands, channels, content)
- Zero mudança visual perceptível: shadcn já usa os mesmos tokens do `styles.css`.

### 4. Tipar respostas das server fns
- Exportar tipos derivados em cada `*.functions.ts`: `export type Brand = Awaited<ReturnType<typeof listBrands>>[number]` (mesmo para Channel, Mission, Content, SchedulerJob).
- Substituir todos os `(x: any)` nas rotas pelos tipos exportados.

### 5. Helper de evento de domínio
- `src/lib/domain/events.server.ts`: `recordDomainEvent(supabase, { workspaceId, eventType, payload })`.
- Aplicar em `channels.functions.ts` (`ChannelRegistered`) e em outros pontos que ainda inserem inline.

### 6. Padronizar imports
- Ordem: react/externos → `@/` aliasados → relativos.
- Quebrar imports de lucide grandes em uma única linha multi-import por arquivo.
- Sem reformat global — só os arquivos tocados pelos passos anteriores.

### 7. Workspace gate no layout autenticado
- Em `src/routes/_authenticated/app.tsx`, validar `wsId` uma vez e renderizar um skeleton se nulo, em vez de cada rota filha repetir `enabled: !!wsId`.
- Expor `wsId` via `Route.useRouteContext()` ou um `<WorkspaceProvider>` simples.

## Fora de escopo (intencional)

- Não toco em `src/components/ui/*` (shadcn auto-gerado).
- Não toco em `src/integrations/supabase/*` (auto-gerado).
- Não toco em `src/lib/oauth/*` nem `src/lib/scheduler/*` — já estão bem segmentados e em produção.
- Não troco a estrutura `lib/api/` por uma estrutura `features/` (mudança grande, ROI baixo no tamanho atual).
- Não altero migrations, RLS, schedule cron, ou rotas públicas.

## Garantias

- Nenhuma mudança em URL, payload, schema, ou comportamento visível.
- Cada passo é commit-friendly e revertível independentemente.
- Tipos passam a ser mais estritos (remoção de `any`), o que o próprio build vai validar.

Confirma para eu executar os 7 passos em sequência?
