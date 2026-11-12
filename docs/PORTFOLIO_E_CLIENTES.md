# VELT — portfólio agora, clientes depois

Atualizado em 12/11/2026. Este documento descreve o código, não certifica integrações externas nem substitui uma homologação de produção.

## Primeira rodada de melhorias

- **Estado de workspace compartilhado:** `useSyncExternalStore`, persistência com tolerância a storage bloqueado, sincronização entre abas e validação da seleção contra memberships.
- **Sessão e links internos:** a área privada usa `ssr: false`, pois a sessão atual vive no navegador. Páginas públicas continuam com SSR. RPCs mantêm autenticação Bearer no servidor e RLS. Login preserva somente destinos internos `/app/*`, incluindo query e fragmento.
- **Logout:** remove a seleção e o cache privado. As consultas de perfil e memberships incluem o ID do usuário.
- **Primeiro uso:** painel de tarefas e progresso; a visão avançada permanece disponível, recolhida.
- **Onboarding:** criar workspace ou fechar o assistente não grava conclusão. Somente a ação final conclui; a marca criada atualiza o progresso do painel.
- **Conteúdo no celular:** formulário de rascunho primeiro, campos rotulados, salvar sem publicar, Studio opcional recolhido.
- **Estados honestos:** no aplicativo e na API editorial, mudanças manuais só aceitam rascunho/arquivado. Agendamento e publicação pertencem ao fluxo de entrega. Isso não é uma política de coluna do Postgres: acesso direto ao banco e permissões REST ainda precisam de revisão completa antes de clientes.
- **Idioma e acessibilidade:** fluxo principal de marcas/canais/conteúdo/agendamento traduzido em pt-BR/en-US, nomes acessíveis e correção dos contrastes reproduzidos. Outros módulos avançados ainda têm textos fixos.
- **Exemplos:** catálogo global de oportunidades identificado como demonstrativo; compatibilidade não é pesquisa de mercado ao vivo.
- **Metadados:** títulos próprios por módulo usando o helper compartilhado.
- **Configuração:** referências públicas do Supabase atualizadas, migration RLS já aplicada incorporada ao repositório, Node 22 LTS e heap de build de 4 GB.

## Segunda rodada de melhorias

- **Perfil confiável:** consulta compartilhada com chave por usuário, nome carregado no formulário, validação de 1 a 80 caracteres após trim e gravação confirmada pela linha retornada. Cabeçalho e cache recebem a confirmação do servidor; falhas preservam o rascunho.
- **Recuperação sem desmontagem:** uma falha de refresh de perfil/workspaces com dados válidos em cache não desmonta a área privada. O formulário informa a falha e permite nova tentativa sem sobrescrever a edição.
- **Equipe e privacidade:** correção do join PostgREST que não existia no schema. Membros e perfis são lidos separadamente com o cliente autenticado do chamador, sem service role, migration ou ampliação de RLS. Quando outro perfil não está visível, a interface explica a restrição e mostra um identificador abreviado; papéis são traduzidos. A tela é de consulta, não de convites ou administração de permissões.
- **Celular e idioma:** abas de Configurações em duas colunas em telas pequenas, alvos de 44 px e traduções pt-BR/en-US de perfil/equipe/análises.
- **Análises honestas:** erro do resumo e erro dos requisitos de coleta têm estados/retries próprios. Leituras de readiness verificam membership e propagam erros de canais, contagens e snapshots em vez de inventar zeros.
- **Capacidade não é homologação:** a lista de coletores vem do código implementado (Instagram, Facebook, YouTube e LinkedIn). TikTok e Google Business não são marcados como capazes de insights nesta versão. Um coletor implementado não comprova credencial válida nem aprovação do provedor; publicações `sim_` não contam como efetivas nos requisitos.
- **Snapshots e acessibilidade:** o indicador passa a se chamar coletas/snapshots, com ressalva de que somar coletas cumulativas pode repetir valores. Não houve deduplicação da agregação. Período usa radios nativos; tabelas equivalentes aos gráficos permitem leitura sem depender do desenho. Datas de coleta preservam o dia UTC e números seguem o idioma.
- **Relatórios:** PDF/CSV autenticados verificam status HTTP, MIME esperado, corpo não vazio e timeout de 30 segundos antes de iniciar o download. Arquivos permanecem em português; nenhum envio automático por e-mail é prometido.

A validação local desta rodada passou em typecheck, lint, 444 testes/43 arquivos, auditoria de dependências de produção e build Vercel. No artefato compilado local, 19 verificações de navegador e 9 estados com Axe passaram. Foram usados usuários/workspaces descartáveis com limpeza verificada; nenhum canal foi conectado e nenhum conteúdo foi publicado. As verificações selecionadas de isolamento não equivalem à revisão completa de RBAC/RLS. Consulte [o registro de QA da rodada 2](./QA_PORTFOLIO_RODADA_2.md) para método e limitações. O sucesso local não comprova publicação remota nem aprovação do CI remoto.

## Rótulo de portfólio não é modo de simulação

`VITE_PORTFOLIO_MODE=true` exibe uma identificação pública e dentro do aplicativo. Não desativa autenticação, não remove RLS, não fornece credenciais públicas e não inventa métricas ou publicações.

`VITE_GOOGLE_AUTH_ENABLED` fica desligado por padrão. Só ative a opção de login Google depois de configurar e validar o provedor. Ela é independente das conexões de redes sociais.

`VELT_PUBLISHER_MODE=simulate` **não** deve ser usado na publicação atual. O flag de portfólio não altera esse valor.

## Regressão no navegador

A suíte abaixo usa login real em um contexto novo, sem inserir sessão ou workspace no storage. É uma verificação de leitura: não conecta redes, não cria conteúdo e não dispara publicações.

```bash
npm ci
npx playwright install --with-deps chromium
# Configure fora de arquivos versionados:
# VELT_QA_BASE_URL, VELT_QA_EMAIL, VELT_QA_PASSWORD
npm run test:e2e
```

Use conta de teste com onboarding concluído. `VELT_QA_DEVICE=desktop` ou `mobile` permite dividir a execução. Resultados ficam em `.qa-artifacts/` (ignorado pelo Git), ou em `VELT_QA_OUTPUT_DIR`. Capturas podem conter dados da conta: não publique relatórios de navegador sem revisão.

A suíte cobre contexto novo, retorno de login, acesso direto, recarga de cinco módulos, títulos, largura e axe em desktop/mobile. A auditoria de um estado vazio não cobre formulários preenchidos, todos os diálogos nem certifica WCAG. Uma jornada adicional de QA com usuário temporário foi usada para testar onboarding, CRUD, troca em duas abas e troca de conta; os recursos temporários foram removidos.

## Publicação e sincronização

Em 12/11/2026, após autorização pelo navegador com o GitHub CLI oficial, os dois commits de melhorias (`6a01104` e `4a60a71`) foram enviados ao `main` de `Implantac/velt-hub-platform`. O SHA remoto foi conferido depois do push. Não houve force-push nem reescrita do histórico.

As próximas publicações usam o código de `Implantac/velt-hub-platform`: um push no `main` aciona a integração Git nativa da Vercel no projeto existente. O checkout contém o `package.json` e o lockfile completos: a instalação normal é `npm ci --no-audit --no-fund`, seguida do build com Node 22 LTS e heap de até 4 GB. O resultado do deploy Git e o smoke público ficam registrados separadamente no relatório operacional da entrega; não são presumidos pelo sucesso dos testes unitários.

### Deploy automático do `main`

- O repositório conectado e a branch de produção continuam sendo `Implantac/velt-hub-platform` e `main`. O domínio público continua `https://velt-hub-platform.vercel.app`.
- A opção de criação de deploys pelo Git está habilitada no projeto. Eventos `repository_dispatch` continuam desabilitados; o fluxo usa o evento normal de push.
- `vercel.json` permite deploy automático somente para `main`: `"**": false` desabilita as demais branches, inclusive nomes com `/`, e `"main": true` libera a branch de produção. A regra verdadeira prevalece quando os padrões coincidem. Para habilitar previews no futuro, revise essa configuração explicitamente.
- O CI do GitHub continua executando typecheck, lint, testes, build e auditoria de dependências em paralelo ao deploy. **Esta configuração não faz a Vercel aguardar o CI** nem adiciona proteção de branch. Antes de liberar versões para clientes, homologue proteção do `main`, checks obrigatórios e promoção condicionada à aprovação.
- Confirme que o SHA no deploy concluído corresponde ao `main`, que o estado é `READY / PROMOTED` e que o domínio está associado. Faça o smoke público após a publicação. A ativação não é considerada validada apenas por salvar a configuração do projeto.
- Para interromper o gatilho, desabilite a criação de deploys Git no projeto. Um rollback emergencial pela Vercel não desfaz o Git: alinhe o repositório com um commit de reversão revisado, sem force-push, para que o próximo push não reintroduza a versão problemática.

A configuração usa a integração nativa; não adiciona token permanente ao GitHub Actions, deploy hook público ou segredo ao repositório.

### Histórico da publicação inicial por arquivos

Antes dessa autorização, a publicação inicial utilizou um snapshot de fontes, acompanhado de ZIP, patch e proveniência. Esse material é um registro histórico: a indicação de GitHub pendente naquele pacote antecede o push confirmado acima.

O bootstrap dessa publicação inicial restaura um arquivo de fontes em um bucket **privado** do Supabase exclusivo e confere seu SHA-256 antes de instalar o lockfile. As credenciais vêm somente do ambiente protegido da Vercel, nunca do pacote de código, e a URL de storage é fixa no projeto VELT.

O bucket `velt-deploy-sources` mantém os pacotes imutáveis necessários a rebuilds desse caminho antigo. Preserve-o enquanto houver dependência de rebuild/rollback dessas publicações. Ele não é uma biblioteca pública de mídia nem um recurso do produto.

A configuração condicional de instalação aceita os dois caminhos: quando existe `restore-velt-source.mjs`, ele precisa concluir com sucesso; em um checkout Git normal, sem esse arquivo, executa somente `npm ci`. Um deploy Git do repositório sincronizado não depende desse bucket.

Na sincronização inicial, o deploy pelo SHA foi disparado explicitamente, pois o gatilho automático estava desabilitado. A ativação do deploy automático foi autorizada em uma etapa posterior e usa o fluxo descrito acima. Publicações explícitas por SHA continuam possíveis e não comprovam, por si só, o funcionamento do gatilho.

## Banco e automações existentes

A migration `20261112143126_workspace_owner_returning_visibility.sql` já havia sido aplicada no Supabase exclusivo e agora está versionada. Não é necessário reaplicá-la manualmente nesse projeto. Não desative RLS para corrigir bootstrap.

Os dois crons em operação usam um segredo do Vault chamado `velt_cron_secret`, não `ALTER DATABASE`. O segredo deve ser idêntico a `CRON_SECRET` no ambiente protegido do servidor. O comando do job consulta o Vault na execução e não contém o valor em texto.

- `velt-scheduler-tick`: a cada minuto, `POST /api/public/cron/scheduler-tick`.
- `velt-analytics-sync`: a cada 6 horas, `POST /api/public/cron/analytics-sync`.

Um HTTP 200 sem canais ou jobs não valida publicação nem coleta real. O primeiro disparo automático de analytics não foi comprovado na auditoria inicial.

Há uma limitação histórica de instalação: uma migration antiga tenta `ALTER TABLE` em tabela de Realtime que pertence ao Supabase. No provisionamento atual foi omitida somente essa instrução redundante, após confirmar que RLS já estava habilitada. A instalação limpa de todas as migrations pelo CLI ainda precisa de uma homologação específica. Não altere ownership para contornar isso.

## Checklist antes de distribuir a clientes

- [ ] Executar regressão pós-deploy, sem workarounds, em produção e em homologação isolada.
- [x] Sincronizar no GitHub os dois commits da primeira rodada; `main` conferido após o push em 12/11/2026.
- [ ] Homologar continuamente o fluxo completo de CI, instalação limpa e regressão pós-deploy para cada versão destinada a clientes.
- [ ] Validar instalação limpa das migrations e processo de backup/restauração.
- [ ] Completar RBAC/RLS com fixtures de dois clientes, conteúdo existente, convites e todos os papéis. Testes selecionados não são pentest.
- [ ] Configurar e testar SMTP próprio, confirmação e recuperação de senha, limites e mensagens de abuso.
- [ ] Homologar um ciclo real em um canal de teste: autorização, expiração/refresh de token, mídia, agendamento, publicação, retentativa e coleta de métricas.
- [ ] Validar falhas de provedores e idempotência; nenhuma simulação pode ser apresentada como publicação real.
- [ ] Validar IA, limites de custo e tratamento de dados, sem executar geração automaticamente.
- [ ] Revisar permissões de storage, upload e egress para redes privadas; completar proteção contra DNS rebinding.
- [ ] Revisar LGPD, retenção/exclusão, termos, consentimentos e credenciais por ambiente/cliente.
- [ ] Concluir tradução dos módulos avançados e auditoria manual de teclado/leitor de tela.
- [ ] Monitorar crons, filas paradas, erros, quotas e custo. Definir suporte e resposta a incidentes.
- [ ] Desligar o rótulo de portfólio somente quando a liberação comercial estiver aprovada.

A entrega desta rodada melhora estabilidade e apresentação. Não significa que todos os itens de prontidão comercial acima tenham sido executados.
