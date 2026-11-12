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

Para as próximas publicações, use o código do repositório e fixe o SHA a publicar na Vercel. O checkout contém o `package.json` e o lockfile completos: a instalação normal é `npm ci --no-audit --no-fund`, seguida do build com Node 22 LTS e heap de até 4 GB. O resultado do deploy Git e o smoke público ficam registrados separadamente no relatório operacional da entrega; não são presumidos pelo sucesso dos testes unitários.

### Histórico da publicação inicial por arquivos

Antes dessa autorização, a publicação inicial utilizou um snapshot de fontes, acompanhado de ZIP, patch e proveniência. Esse material é um registro histórico: a indicação de GitHub pendente naquele pacote antecede o push confirmado acima.

O bootstrap dessa publicação inicial restaura um arquivo de fontes em um bucket **privado** do Supabase exclusivo e confere seu SHA-256 antes de instalar o lockfile. As credenciais vêm somente do ambiente protegido da Vercel, nunca do pacote de código, e a URL de storage é fixa no projeto VELT.

O bucket `velt-deploy-sources` mantém os pacotes imutáveis necessários a rebuilds desse caminho antigo. Preserve-o enquanto houver dependência de rebuild/rollback dessas publicações. Ele não é uma biblioteca pública de mídia nem um recurso do produto.

A configuração condicional de instalação aceita os dois caminhos: quando existe `restore-velt-source.mjs`, ele precisa concluir com sucesso; em um checkout Git normal, sem esse arquivo, executa somente `npm ci`. Um deploy Git do repositório sincronizado não depende desse bucket.

A sincronização do `main` não significa que deploys automáticos por push estejam habilitados. Essa configuração deve ser conferida na Vercel. A publicação explícita pelo SHA do repositório funciona independentemente desse gatilho.

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
