# Changelog

## [1.11.1] — 2026-10-29

### O coletor que transforma Report-Only em decisão

A CSP entrou em `Report-Only` sem ter onde os relatórios chegarem: a policy
apontava para `/api/csp-report`, que **não existia**. Isso deixava o próximo passo
— ligar `CSP_MODE=enforce` — como ato de fé.

Agora existe o endpoint (`POST /api/csp-report`) e a leitura
(`node scripts/csp-report.mjs [dias]`), que responde à única pergunta útil:
_quais diretivas quebrariam, para quais hosts, com que frequência_ — e já sugere
a diretiva pronta para colar se a violação for legítima.

#### Endpoint público exige cuidado

Browsers postam nele sem credenciais. Daí: corpo limitado a 8 KB (rejeitado
**antes** de parsear), só campos da spec, throttle por IP, e a URL gravada
**sem query string** — o relatório é justamente sobre uma URL que o atacante
controla, e persistir isso inteira é repetir o erro do advisory uma camada abaixo.

#### A falha que faz o relatório mentir

Primeira versão: `try { insert } catch { console.error }` e sempre `204`. O dev
não tinha `SUPABASE_SERVICE_ROLE_KEY`, o insert falhou em **28 relatórios**, e o
endpoint respondeu 204 — indistinguível de "gravou". O script então imprimiria
"nenhuma violação, seguro para enforcer" sobre um banco vazio.

Duas correções:

- escrita que falha agora é **500**, não 204;
- o script **não confia no silêncio**: sem violações ele testa o coletor e, se
  não conseguir provar que grava, sai com "Zero pode significar _política limpa_
  ou _nada foi coletado_. NÃO ligue enforce".

Ausência de dado nunca pode ser lida como aprovação.

#### Bug pego pelo teste

`suggestionFor("script-src-elem", ["inline"])` gerava `script-src inline` —
sintaticamente válido, mas o token `inline` não é source expression: a violação
continuaria e o conselho pareceria seguido. `inline`/`eval`/`wasm-eval` passaram a
ser reconhecidos como não-hosts e o caso vira uma explicação ("provavelmente falta
'unsafe-inline' ou um nonce").

### A armadilha do ambiente (custou 8 builds)

O build passou a morrer por OOM e o suspeito óbvio era o código novo. **Não era.**
Isolando por remoção — rota, arquivos, teste, script — o build continuou
quebrando, até sobrar apenas `package-lock.json` modificado.

O `npm install` sem lock re-resolveu a árvore (o lock estava fora de sincronia com
o `package.json`) e mudou o perfil de memória o suficiente para estourar o passo do
Nitro. `git checkout package-lock.json && npm ci` devolveu o build a 49 s.

Regra: **nunca `npm install` neste repo sem conferir o diff do lock depois.** Aqui,
`npm ci` é o único jeito de instalar sem alterar o perfil do build.

**Nota sobre o teto de heap (`--max-old-space-size=1300`)**: ele continua sendo
necessário _neste ambiente de 2 GB_. Um commit posterior trouxe a causa raiz
parcial — `lucide-direct-imports`, que mantém ~1.900 módulos de ícone não usados
fora do grafo — mas `vite build` puro ainda morre por OOM aqui; `npm run build`
(com o teto) fecha em 33 s. O teto é paliativo, a correção do lucide é estrutural:
as duas convivem.

### Números

- testes: **307 em 22 arquivos** (+8: `hostOf`, injeção de diretiva, resumo)
- `tsc` 0 · `eslint` 0 · `vite build` verde (8,3 M, 49 s)

## [1.11.0] — 2026-10-29

### Segurança — CSP com nonce e fechamento do XSS refletido em server functions

Último item da dívida de segurança: o GHSA-qx66-fv34-fjm8 (CVSS 9.3) estava
**documentado** desde o relatório e não mitigado. Verificado neste app antes de
escrever qualquer linha — `GET /_serverFn/abc` com `Accept: text/html`
devolvia **500 com HTML renderizado**.

#### Duas defesas independentes

1. **Navegação para server function é recusada antes do handler** (`src/server.ts`).
   O transporte existe para `fetch` com `x-tsr-serverFn: true`; uma navegação
   nunca manda esse header. Requisições com cara de navegador (`Sec-Fetch-Mode:
navigate`, `Sec-Fetch-Dest: document` ou `Accept: text/html`) recebem
   **404 text/plain**. Um segundo cinto recusa qualquer resposta `text/html`
   nesse caminho quando o marcador do transporte está ausente.

   O filtro exige marcador de navegador de propósito: um probe de monitoramento
   (curl puro) não manda nenhum deles e não é um ataque.

2. **CSRF no transporte** (`src/start.ts`). O framework avisava a cada boot que
   `requestMiddleware` não tinha CSRF: server functions são RPC de mesma origem,
   e sem isso uma página terceira pode postar em `/_serverFn/<id>` com a sessão
   da vítima. Usa o `createCsrfMiddleware` oficial (Origin / Sec-Fetch-Site /
   Referer), filtrado por `handlerType === "serverFn"`.

#### CSP com nonce por requisição

Em **Report-Only** por padrão; `CSP_MODE=enforce` para bloquear:

```
default-src 'self'; script-src 'self' 'nonce-<32 hex>';
style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:;
connect-src 'self' https://<projeto>.supabase.co wss://...;
form-action 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'
```

O `connect-src` sai do `SUPABASE_URL` real — sem isso o app funciona em dev e
morre em produção, porque toda tela autenticada fala direto com o Supabase.

O nonce tem que casar entre o header e **cada** `<script>` inline do SSR, senão
a hidratação não roda e a página fica branca. Verificado: `nonce` do header
idêntico ao de todos os scripts, e **0 scripts sem nonce**.

#### Quatro becos sem saída, todos encontrados por teste e não por leitura

O caminho até aqui teve quatro hipóteses erradas, cada uma com sintoma diferente:

| tentativa                                                          | sintoma                                                 |
| ------------------------------------------------------------------ | ------------------------------------------------------- |
| nonce via `middleware` + `result.context`                          | `result.context` é contexto, não o router               |
| `getRouter` **async**                                              | build morre por heap OOM (e parece problema de tamanho) |
| `createIsomorphicFn` dentro de `router.tsx`                        | mesmo OOM, **sem** async                                |
| import `.server` ou `@tanstack/react-start/server` em `router.tsx` | import-protection: o router é entry do build de cliente |

O que funciona: **`createServerOnlyFn`** — o bundler remove o stub do cliente e
`getRequest()` é síncrono. Síncrono importa: `async` em `getRouter()` estoura o
passo do Nitro.

#### Números

- testes: **299 em 21 arquivos** (+11: matriz do guard, CSRF de navegação, CSP)
- `tsc` 0 · `eslint` 0 · `vite build` verde (8,3 M)

## [1.10.4] — 2026-10-29

### `npm audit`: 4 moderados → **0**

A cadeia toda vinha de `drizzle-kit`, e nenhuma delas era corrigível por upgrade:
`drizzle-kit@0.31.11` **ainda é a última versão publicada** e continua declarando
`@esbuild-kit/esm-loader@^2.5.5`, um pacote parado em 2022 que por sua vez fixa
`esbuild@0.18.20` — abaixo do `0.24.2` que corrige o advisory (dev server do
esbuild aceita requests de qualquer origem e devolve a resposta).

O `npm audit fix` propunha um "fix" que era **downgrade** para `drizzle-kit@0.18.1`.
Recusado: trocar um dev dependency inteiro de versão para calar um aviso moderado,
em código que gera migrations, é pior que o aviso.

Correção por override do transitivo:

```json
"overrides": {
  "@esbuild-kit/core-utils": { "esbuild": "^0.25.12" }
}
```

O advisory é da API de **serviço** do esbuild (`serve`). `core-utils` só usa
`transform`, então a faixa vulnerável não é alcançável por este caminho; a versão
nova resolve o aviso e mantém o loader funcionando.

### Provado que não quebrou

Override de transitivo falha em silêncio, então:

- `npx drizzle-kit check` → lê `drizzle.config.ts` e valida ("Everything's fine")
- `@esbuild-kit/core-utils` importa, 8 exports, `transform` presente
- `npx tsx` roda TypeScript normalmente
- `npm ls brace-expansion` confirma `1.1.21` (o override do bloco de segurança
  continua valendo — os dois convivem)

**Armadilha encontrada no caminho:** reescrever o `package.json` com
`json.dumps` a partir do objeto carregado **apagou o override existente do
`brace-expansion`**, que corrigia um advisory real. Restaurado e conferido no
`npm ls`.

### Números

- `npm audit`: **0 vulnerabilidades** (era 4 moderate)
- `tsc` 0 · `eslint` 0 · testes 288/288

## [1.10.3] — 2026-10-29

### Lint zerado — 12 → 0 `react-refresh/only-export-components`

O aviso não é cosmético. O React Refresh decide se um módulo pode ser recarregado
isoladamente pelos **exports**: um arquivo que exporta componente _e_ constante
não tem hot-reload confiável. Na prática, cada edição virava recarga de página e
**resetava o estado de todo componente montado no arquivo** — durante o
desenvolvimento, justamente onde estado importa.

O `allowConstantExport: true` do config não resolvia: ele só libera literais
(`string`, `number`, `boolean`, arrays desses). Os presets são objetos calculados.

| arquivo                       | o que vazava                         | para onde foi                                |
| ----------------------------- | ------------------------------------ | -------------------------------------------- |
| `Motion.tsx`                  | `EASE`, `fadeUp`, `stagger`          | `motion-presets.ts` (35 imports atualizados) |
| `ProductTour.tsx`             | `hasSeenTour`, `resetTour`           | `tour-storage.ts`                            |
| `badge` / `button` / `toggle` | `*Variants` (cva)                    | `*-variants.ts`                              |
| `form.tsx`                    | `useFormField`                       | `form-context.ts`                            |
| `navigation-menu`             | `navigationMenuTriggerStyle`         | `navigation-menu-variants.ts`                |
| `sidebar`                     | `useSidebar` + contexto + constantes | `sidebar-context.ts`                         |
| `PlatformIcon.tsx`            | **nenhum componente**                | renomeado para `platform-meta.ts`            |

`PlatformIcon.tsx` era o caso mais honesto: um `.tsx` que não renderizava nada —
só dados e dois lookups. O aviso estava certo; o nome é que estava errado.

### Regressão evitada (e verificada)

Tailwind descobre classes **varrendo arquivos**. Mover strings de classe para
novos `.ts` poderia sumir com estilos sem quebrar `tsc` nem teste nenhum. O CSS
construído foi conferido: `min-w-9`, `min-w-8` (toggle), `[state=open]`
(navigation-menu) e `hover:bg-primary/80` (badge) continuam presentes no bundle.

### Números

- `eslint .`: **0 problemas** (era 12)
- `tsc --noEmit`: 0 erros · testes: 288/288 · `vite build`: verde

## [1.10.2] — 2026-10-29

### Corrigido — o produto se apresentava em inglês para quem fala português

O `head()` das rotas é estático, e a landing anunciava:

```tsx
{
  title: "VELT — AI-native operating system for your digital presence";
}
```

Enquanto o app inteiro é pt-BR por padrão. O título aparece na aba, no resultado
de busca e no preview de todo link compartilhado no WhatsApp — a primeira
impressão do produto, na língua errada, para 100% dos usuários brasileiros.

A causa é estrutural: `useTranslation` é um hook e `head()` não é componente;
ele roda durante o SSR, onde não existe `localStorage` nem `navigator`. Sem ler o
`Accept-Language` da requisição, não há como saber a língua.

Agora existe:

- `resolveLang(acceptLanguage)` em `src/lib/i18n/index.ts` — a mesma resolução do
  cliente (`pt-BR`, `en-US`, base `pt`/`en`, senão o padrão), aplicada ao header;
  q-values são descartados (`pt-BR,pt;q=0.9` → `pt-BR`).
- `requestLang()` em `src/lib/i18n/translate.ts` — lê o header via `getRequest()`
  do start server. Nesta versão do router, `head(ctx)` recebe um `RouteMatch`,
  que **não** carrega o `Request`.
- `translateServer(lang, section, key, fallback)` — lookups no dicionário JSON,
  com o mesmo fallback do cliente (`en-US`) e uma cópia de emergência por rota.

Fallback duplicado de propósito: um fallback que lê a chave da qual está caindo
não é fallback.

Verificado contra o SSR real:

| `Accept-Language`   | `<title>`                                                     |
| ------------------- | ------------------------------------------------------------- |
| `pt-BR`             | VELT — O sistema operacional da sua presença digital          |
| `en-US`             | VELT — The operating system for your digital presence         |
| `de-DE`             | VELT — O sistema operacional da sua presença digital (padrão) |
| ausente             | VELT — O sistema operacional da sua presença digital (padrão) |
| `pt-BR` em `/login` | Entrar · VELT                                                 |
| `en-US` em `/login` | Sign in · VELT                                                |

`og:locale`, `og:title` e `og:description` seguem a mesma decisão, e o root
(herdado por `/bio/*`) também. O `<html lang>` continua `pt-BR` no HTML inicial:
`manifest`/`htmlAttrs` não existem nesta versão do router, então o cliente
corrige o atributo ao hidratar (`applyDirection`).

### Números

- testes: **288 em 20 arquivos** (+3, cobrindo q-values, idioma não suportado e
  header ausente)
- `tsc --noEmit`: 0 erros

## [1.10.1] — 2026-10-29

### Corrigido — 76 `any` a menos, e o que eles escondiam

O bloco anterior tipou o motor do Brain. Este fechou o resto: `no-explicit-any`
saiu de 76 para **zero** no repositório inteiro. O padrão que apareceu em quase
todos os arquivos era o mesmo — leitura de coluna `json` por acesso direto:

```tsx
items={v.strengths ?? []}          // Json | null nunca é string[]
{v.next_steps?.length > 0 && …}    // .length em Json: compila, quebra em runtime
```

Isso não falha no `tsc` (a coluna é `Json`), falha na tela: `[object Object]` na
lista, ou `TypeError` que derruba a página inteira do card. Quatro helpers novos
em `src/lib/json.ts` fecham o buraco, todos **totais** (nunca lançam):

| helper              | coluna                                                                                       | contrato                                              |
| ------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `readStrings`       | `strengths`, `risks`, `indicators_*`, `questions_to_answer`, `next_steps`, `recommendations` | descarta entradas que não são string em vez de coagir |
| `readSummary`       | `ai_analysis`                                                                                | `null` quando não há resumo utilizável                |
| `readTitledActions` | `user_profile_digital.recommended_actions`                                                   | mantém `{ title, href? }`, exige `title`              |
| `errorMessage`      | qualquer `catch`                                                                             | nunca devolve `undefined`                             |

### Corrigido — toast vazio no momento da falha

```tsx
} catch (e: any) {
  toast.error(e.message);
```

`throw` não exige `Error`. Um reject com string, com `{ error }` do corpo de uma
resposta, ou com nada, fazia `e.message` ser `undefined` — o usuário via um toast
**em branco** exatamente quando algo dava errado. `errorMessage(e)` recupera a
mensagem de `Error`, string, `{ message }` e `{ error }`, e só então usa o texto
padrão.

### Melhorado — a UI não consegue mais enviar um `change_type` que o validador rejeita

`RealityCheckTab` fazia `change_type: changeType as any`. A lista do `<Select>`
era digitada à mão e podia divergir do `z.enum` do servidor sem ninguém notar.
Agora existe uma fonte única:

```ts
export const REALITY_CHANGE_TYPES = ["pivot", "new_channel", …, "investment"] as const;
```

O zod usa `z.enum(REALITY_CHANGE_TYPES)` e o `<Select>` estreita o valor com um
type guard. Adicionar uma opção na tela e esquecer o validador passou a ser erro
de compilação.

### Corrigido — `npm run build` não rodava no ambiente de 2 GB

O passo do Nitro (bundle do servidor) estabiliza em ~1,3 GB residentes. Com o
padrão do V8 o processo era morto pelo kernel sem mensagem útil (`Killed`), e o
`.output/` ficava **parcial** — o que é pior que falhar, porque parece ter dado
certo. O script agora fixa o teto:

```json
"build": "node scripts/check-env.mjs && node --max-old-space-size=1300 node_modules/vite/bin/vite.js build"
```

### Números

- `tsc --noEmit`: 0 erros · `eslint`: 0 `no-explicit-any` (restam 12
  `react-refresh` pré-existentes em componentes shadcn)
- testes: **285 em 20 arquivos** (+13, cobrindo os helpers novos e `errorMessage`)
- `npm run build`: verde, `.output/` completo

## [1.10.0] — 2026-10-28

### Corrigido — "melhor horário para publicar" nunca funcionou

O motor de crescimento agrupa `analytics_snapshots` por `content_id` para achar a
métrica mais recente de cada post publicado, e disso deriva o horário ideal. A
consulta era:

```ts
.select("id, metrics, captured_at")   // content_id nunca foi buscado
```

O agrupamento fazia `if (!snap.content_id) continue` — ou seja, **todos** os
snapshots eram descartados. O mapa ficava vazio, `timingSource` ficava em
`"baseline"` para sempre, e o recurso respondia com médias de mercado em vez dos
dados do próprio usuário.

O pior detalhe: a correção disso já estava escrita e comentada no código
("_antes do sync de métricas esta lista era sempre vazia, por isso o melhor
horário só podia retornar baselines_"). A lista continuou vazia porque a coluna
que a alimenta nunca foi pedida. E `analytics: any[]` garantia que nada
reclamasse.

### A causa: `BrainContext` era 100% `any`

Todas as fatias de dados do cérebro — `profile`, `workspace`, `brands`,
`channels`, `content`, `jobs`, `analytics`, `opportunities`, `memory`,
`blueprint`, `competitors`, `skills` — eram `any`. Cada motor lia campos
arbitrários, e um campo inexistente virava `undefined` em runtime em vez de erro
de compilação.

Agora os tipos são **derivados do schema gerado**:

```ts
export type Row<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
```

E as três fatias carregadas com projeção declaram exatamente o que é buscado —
`content_id` é obrigatório em `AnalyticsSlice` porque é disso que o agrupamento
depende. Reintroduzir o bug agora **não compila**: verificado revertendo o
`select` de propósito, o compilador aponta três erros.

### Outros três achados do mesmo tipo

1. **`skill_assessments` não tem coluna `level`.** O dashboard lia
   `s.level ?? s.score`, então a primeira metade nunca existia; a média de
   skills só funcionava por causa do fallback. Corrigido para `score`, que é a
   coluna real.
2. **`healthList` pode conter `null`.** A média somava `h.score` direto; com
   `any` o compilador não via, e um item nulo derrubaria o cálculo no render.
3. **O motor recomendava canais inexistentes** (`whatsapp`, `twitter`) — já
   corrigido em 1.9.2, mas o tipo `string[]` era a razão de passar despercebido.

### Testes

**264 testes**, verdes. Os casts `as never` / `as any` que existiam nos testes do
Brain para "fazer compilar" foram removidos: eles eram o sintoma de que o tipo
real não casava com o que os motores liam.

### Lint

**111 → 76 erros de `any`**. O restante está em componentes de UI e rotas de
dashboard, mesmo padrão, ainda por converter.

## [1.9.2] — 2026-10-28

### Corrigido — o Brain recomendava canais que não existem

A pergunta "para quais plataformas o VELT publica?" tinha três respostas no
código:

| Onde                               | Resposta                                                        |
| ---------------------------------- | --------------------------------------------------------------- |
| Enum `social_platform` no banco    | instagram, facebook, youtube, tiktok, linkedin, google_business |
| `PLATFORMS` no componente de ícone | as mesmas seis                                                  |
| Motor de negócio do Brain          | as seis **+ `whatsapp` e `twitter`**                            |

A terceira era o defeito. O motor calculava "canais prioritários" para cada tipo
de negócio e recomendava **WhatsApp e Twitter** — que não existem no enum, não
têm publisher e não podem ser conectados. O tipo era `string[]`, então nada
reclamava: a recomendação simplesmente não podia ser seguida.

### A correção não é apagar as duas linhas

Apagar teria resolvido o sintoma e deixado a causa: uma lista de plataformas que
não é verificada contra a realidade do banco. Agora existe `src/lib/platforms.ts`
como fonte única, e o tipo é derivado do enum gerado:

```ts
export type Platform = Database["public"]["Enums"]["social_platform"];
```

Isso torna o erro **impossível de reescrever**: sugerir uma plataforma que o enum
não tem passa a ser erro de compilação. `PLATFORMS`, os rótulos e as
recomendações por tipo de negócio vivem no mesmo lugar, e o componente de ícone
passa a derivar os ids de lá em vez de declarar os seus.

### Testes

**264 testes (era 257)**: 7 novos, incluindo "nunca recomenda um canal que o
produto não pode publicar" (iterando todos os tipos de negócio), "não recomenda
mais whatsapp nem twitter" — nomeados no teste, para que uma edição futura tenha
que encará-los — e "a lista bate com o enum do banco", que falha de propósito se
o enum ganhar um valor e alguém esquecer de decidir o que fazer com ele.

## [1.9.1] — 2026-10-28

### Corrigido — o seletor oferecia 16 idiomas e entregava 2

O seletor de idioma listava dezesseis opções. Apenas **pt-BR e en-US** tinham
tradução; as outras catorze caíam no fallback em inglês. Quem escolhia 日本語 via
a interface inteira em inglês — sem aviso, sem indicação de que a escolha tinha
sido ignorada.

Isso não é "em breve". É um defeito na primeira tela que um usuário não-brasileiro
toca, enviado para todos.

A lista agora tem **dois** idiomas — os que existem. Adicionar outros continua
barato: um JSON em `locales/`, uma linha em `SUPPORTED_LANGUAGES`, nada mais.

### Um caso de borda que o código antigo não tratava

Quem havia escolhido `de` antes da redução mantém `"de"` salvo no navegador. A
detecção antiga confiava no valor salvo sem revalidar contra a lista, o que
deixaria a interface no fallback e o seletor mostrando um código inexistente.
Agora a preferência salva só vale se ainda for oferecida; caso contrário, cai na
preferência do navegador por idioma-base (`pt-PT` → `pt-BR`).

O suporte a RTL foi mantido como conjunto de locales, vazio hoje: a primeira
língua da direita para a esquerda é uma linha, não um refactor.

### Testes

**257 testes (era 249)**: 8 novos, incluindo "ignora escolha salva de idioma que
não é mais oferecido", o mapeamento de variantes regionais, e a verificação de que
as chaves de amostra resolvem para strings diferentes nos dois idiomas — o teste
que pega uma tradução faltando antes do cliente pegar.

## [1.9.0] — 2026-10-28

### Adicionado — feature flags, começando por esconder o Commerce Hub

O **Commerce Hub** ocupava um grupo inteiro da navegação principal com quatro
cards "Em breve": fornecedores, dropshipping, marketplaces e validação de
produto. **Nenhum existe.** É uma promessa que o produto não cumpre, presente em
toda tela, para todo usuário — e o custo não é só credibilidade: é manutenção de
uma superfície que não faz nada.

Agora fica atrás de `VITE_FLAG_COMMERCE`, **desligada por padrão**.

### Por que flag de build, e não de runtime

O caminho óbvio seria uma flag por tenant no banco: ligar para um cliente sem
deploy. Para este caso é pior. Um módulo escondido por flag de runtime **continua
enviando seu JavaScript para todos os navegadores**, continua tendo sua rota no
bundle e continua tendo que ser considerado em toda mudança futura. O que se quer
evitar é _manter_ um produto que não existe — e a flag de runtime não evita isso,
só esconde.

Com flag de build, ligar um módulo é um ato deliberado, com deploy atrás.

### Três lugares que precisam concordar

Esconder o link não é esconder a página — rotas são conhecimento público e
pessoas compartilham URLs. Por isso:

1. **Navegação** — o grupo é filtrado na origem (`NAV_GROUPS`), não em cada
   consumidor.
2. **Busca** — a paleta de comandos mantinha uma **cópia própria** da árvore de
   navegação. Duas listas que deveriam concordar, mantidas em arquivos
   diferentes, é divergência marcada no calendário. Agora ela consome
   `NAV_GROUPS`.
3. **Rota** — `beforeLoad` lança `notFound()`, não redirecionamento: do ponto de
   vista deste build, a página não existe.

### Fecha para fora

O leitor de flag só aceita `"true"` explícito. `1`, `yes`, `on` e `TRUE!` ficam
desligados — um typo deve fechar a porta, não abri-la. Há teste para cada um.

### Testes

**249 testes (era 244)**: 5 novos cobrindo ausência, string vazia, valores que
"parecem" verdadeiros, as variações de `true` e a concordância entre `FEATURES` e
`isFeatureEnabled`.

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
