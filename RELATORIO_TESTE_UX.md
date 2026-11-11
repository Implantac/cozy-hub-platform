# Relatório de teste de experiência — VELT

**Data:** 11/11/2026
**Escopo:** primeira visita, autenticação sem sessão e inspeção estática do onboarding/navegação.
**Ambiente:** dev server local com Node 22.13.0; preview aberto na porta 8080.

## Resumo

A entrada pública e as telas de login/cadastro respondem corretamente. Rotas privadas levam a pessoa sem sessão para o login. A experiência completa depois de entrar não pôde ser validada: não usei nem criei conta, para evitar gravar dados num Supabase que pode ser remoto, e o ambiente local não tem a variável server-side `SUPABASE_SERVICE_ROLE_KEY`, necessária para carregar a página pública de bio.

O maior problema reproduzível é a inconsistência de idioma na renderização inicial. Também há sinais claros de excesso de orientação inicial e de navegação extensa para alguém que só quer conectar um canal, preparar um post e entender o resultado.

## Percurso executado

1. `GET /` — **200**. Landing em pt-BR com chamadas para entrar/criar conta.
2. `GET /login` e `GET /signup` — **200**. Formulários são renderizados no servidor.
3. `GET /app`, `/app/content` e `/app/scheduler` sem sessão — redirecionam para `/login` (o cliente HTTP termina em **200** depois de seguir o redirecionamento).
4. `GET /bio/demo` — mostra “Temporariamente indisponível”, com opção de tentar novamente. O log do dev server confirma falta da configuração server-side do Supabase; isso impediu testar uma bio publicada e não prova falha de uma página real.
5. Não enviei credenciais, não criei conta, não conectei rede social e não alterei dados externos.

## Dificuldades e melhorias recomendadas

### P0 — Resolver o idioma antes de servir a primeira tela

**Reprodução:** pedi `/`, `/login` e `/signup` com `Accept-Language: en-US`. O `<title>` veio em inglês, mas o conteúdo SSR ainda veio em português. Na landing, vários textos continuarão em português mesmo depois da hidratação porque são literais no componente. O seletor também fica oculto na landing abaixo do breakpoint `sm`.

**Impacto:** primeira impressão inconsistente, salto de idioma ao carregar e experiência incompleta para quem escolhe inglês.

**Melhoria:** persistir a escolha num cookie acessível ao servidor (ou usar prefixo de idioma na URL), inicializar SSR e cliente com o mesmo locale, traduzir todo o texto da landing e manter acesso ao seletor em telas estreitas. Adicionar teste SSR para pt-BR e en-US.

### P1 — Tornar a primeira sessão curta e orientada a uma tarefa

**Sinal no código:** o onboarding pede nome e criação de uma marca em quatro etapas; ao terminar, o tour de produto de oito etapas abre automaticamente. O botão “Pular” do onboarding marca o onboarding como concluído, mas não marca o tour como visto, então a pessoa pode ser imediatamente recebida por outro fluxo obrigatório na prática. No tour, vários alvos ficam na sidebar desktop, que não está visível em viewport móvel.

**Impacto:** muita explicação antes de chegar ao primeiro resultado; “pular” não parece respeitar a intenção da pessoa, e o tour móvel pode não destacar os elementos descritos.

**Melhoria:** substituir os dois fluxos por uma checklist curta e dispensável: criar workspace/marca, conectar um canal, criar ou importar conteúdo, revisar pré-voo e agendar. Lembrar a escolha de pular; disponibilizar o tour depois sob demanda; ter alvos e passos próprios para mobile.

### P1 — Reduzir a carga de navegação para novos usuários

**Sinal no código:** a sidebar expõe aproximadamente 22 destinos em seis grupos (mais configurações); algumas áreas são especializadas, como Brain Lab, mapa de skills, jornada, concorrentes e Trust.

**Impacto:** dificulta decidir por onde começar e esconde o fluxo principal entre recursos avançados.

**Melhoria:** priorizar quatro ações no primeiro nível — **Canais, Conteúdo, Agendamento e Resultados** — e mover ferramentas avançadas para “Mais ferramentas”. Na dashboard, deixar uma próxima ação evidente baseada no estado real do workspace.

### P1 — Melhorar recuperação de acesso e acessibilidade dos formulários

**Observação:** não encontrei link de “Esqueci minha senha” no login. Nos formulários, os `label` não apontam para `id` dos inputs, e os campos não declaram `autocomplete`.

**Impacto:** recuperação de acesso fica sem saída visível; leitores de tela, clique no rótulo e preenchimento automático ficam piores.

**Melhoria:** adicionar recuperação de senha, rótulos associados (`htmlFor`/`id`), `autocomplete="email"`, `current-password`/`new-password`, foco visível e erros junto ao campo. Normalizar mensagens do Supabase para linguagem simples e pt-BR.

### P1 — Tratar confirmação de e-mail com instrução explícita

**Sinal no código:** após `signUp`, a tela sempre mostra “Conta criada. Bem-vindo ao VELT.”, mas não distingue se a sessão foi criada ou se a pessoa precisa confirmar o e-mail. Se a confirmação estiver habilitada no Supabase, o fluxo pode parecer parado no cadastro.

**Melhoria:** inspecionar `data.session`; quando não houver sessão, mostrar “Confira seu e-mail”, o endereço usado, opção de reenviar e um caminho claro para voltar ao login.

### P1 — Exibir estados de erro e recuperação dentro do app

**Sinal no código:** o bootstrap do workspace usa `data ?? []`; uma falha de carregamento pode aparecer como “sem workspace”, sem explicar erro ou oferecer nova tentativa. Na dashboard, depois do estado de loading, o componente usa `overview.data!` sem tratar `overview.isError`.

**Impacto:** falha temporária de rede/servidor pode virar tela vazia, falsa mensagem de ausência de workspace ou exceção em vez de uma ação recuperável.

**Melhoria:** separar “nenhum workspace” de “não foi possível carregar”; mostrar causa segura, botão de tentar novamente e skeleton/erro por seção da dashboard. Cobrir os casos com testes de erro do React Query.

### P2 — Alinhar linguagem e promessa da landing ao público iniciante

**Observação:** a primeira tela usa termos internos/técnicos como “AI-native”, “Cérebro Cognitivo Nativo”, “RLS”, “reality-check” e “multi-tenant”, além da promessa de workspace em 60 segundos.

**Melhoria:** explicar o resultado em linguagem concreta — publicar com menos esforço e saber o que funcionou — e mostrar um exemplo real de fluxo/resultado. Manter detalhes de arquitetura numa seção técnica. Revisar a promessa de 60 segundos incluindo confirmação de e-mail, primeira marca e conexão de canal.

### P2 — Diferenciar falha de serviço de página inexistente na bio pública

**Observação:** na ausência do segredo Supabase local, `/bio/demo` mostra o estado indisponível mas retorna HTTP 200. A interface informa a falha e aplica `noindex`, o que é melhor que exibir uma página vazia, porém monitores e caches podem interpretar 200 como sucesso.

**Melhoria:** quando possível, responder 503 nesse estado e manter 404 para slug ausente/não publicado. Criar teste de integração com Supabase local para os três casos: página publicada, inexistente e serviço indisponível.

## Limites do teste

- A sessão autenticada e o fluxo real de criação de conta não foram executados por falta de uma conta de teste autorizada; não criei dados no backend.
- A bio pública não pôde ser verificada com dados reais porque a configuração server-side exigida não está presente no ambiente local.
- O percurso foi verificado por HTTP/SSR e inspeção dos fluxos e componentes; não fiz automação visual em navegador nem medi layout em dispositivos físicos.

## Reteste após aplicar melhorias

**Verificação:** SSR/HTTP repetido após as mudanças, sem conta autenticada e sem enviar dados ao Supabase.

- `/`, `/login` e `/signup` retornam HTTP 200. Com `Accept-Language` pt-BR/en-US, idioma do `<html>`, título e textos renderizados no servidor correspondem ao idioma solicitado; cookie `velt_lang=en-US` prevalece sobre `Accept-Language: pt-BR`.
- Rotas de login e cadastro foram inspecionadas em SSR. A tela de recuperação foi alterada para os modos `?mode=reset` e `type=recovery`; confirmar senha, solicitar e-mail de recuperação e atualizar senha dependem do Supabase no navegador e não foram executados.
- A landing foi reescrita para explicar canais, preparo/agendamento e resultados. O primeiro nível da navegação foi reduzido para o fluxo mais comum, deixando ferramentas especializadas agrupadas em “Mais ferramentas”; a preferência de idioma permanece acessível em telas estreitas.
- Tour agora é iniciado sob demanda, com etapas de navegação desktop e móvel; leituras do viewport foram protegidas contra execução durante SSR.
- Login/cadastro receberam recuperação de senha, textos de erro mais claros, semântica de campos e preenchimento automático; cadastro diferencia confirmação de e-mail quando o Supabase não cria uma sessão. Workspace/dashboard mostram erro recuperável com nova tentativa.
- Validação final em Node 22.13.0: `npm run verify` passou (typecheck, lint, 339 testes em 32 arquivos, guard de ambiente e build Nitro). Foi necessária swap temporária de 1,5 GiB para o build no sandbox; removida após a validação.

**Verificação adicional de segurança:** em servidor local com um segredo de teste descartável, ambos os endpoints de cron responderam 405 a GET e 401 a POST sem segredo, com segredo incorreto ou somente `apikey`. Nenhuma solicitação autorizada foi enviada, portanto nenhuma tarefa ou integração remota foi acionada. A função server-side da bio também migrou de `.inputValidator()` para `.validator()`.

**Limites mantidos:** não usei credenciais reais, não criei dados remotos, não testei execução autenticada de cron, fluxos autenticados nem callbacks reais de e-mail, e não fiz navegação visual automatizada em browser. A bio pública ainda depende da configuração Supabase server-side ausente neste ambiente.
