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

## Publicação desta rodada

O acesso GitHub disponível na sessão não permitiu enviar commits. Para não afirmar uma sincronização inexistente, a entrega inclui um ZIP do código e um patch a partir do commit-base do repositório. Os commits locais e o estado de push são registrados separadamente no arquivo de proveniência da entrega.

A publicação por arquivos na Vercel usa um bootstrap mínimo: ele restaura um arquivo de fontes em um bucket **privado** do Supabase exclusivo e confere seu SHA-256 antes de instalar o lockfile. O instalador recebe as credenciais somente do ambiente protegido existente; o pacote de código não contém credenciais de servidor. A URL de storage é fixa no projeto VELT.

O bucket `velt-deploy-sources` guarda os pacotes imutáveis necessários a um novo build dessa publicação. Não o remova enquanto houver dependência de rebuild/rollback desse caminho. Ele não é uma biblioteca pública de mídia nem um recurso do produto.

O comando de instalação é condicional: se houver `restore-velt-source.mjs`, o bootstrap precisa concluir com sucesso; em um checkout normal do repositório, sem esse arquivo, executa apenas `npm ci`. Assim, a configuração não exige o bootstrap depois que o código estiver sincronizado no GitHub.

Não religue automações Git antes de sincronizar a versão entregue: o `main` remoto ainda pode conter a versão anterior. O smoke público pós-build é registrado no relatório da entrega, não presumido pelo sucesso dos testes unitários.

## Banco e automações existentes

A migration `20261112143126_workspace_owner_returning_visibility.sql` já havia sido aplicada no Supabase exclusivo e agora está versionada. Não é necessário reaplicá-la manualmente nesse projeto. Não desative RLS para corrigir bootstrap.

Os dois crons em operação usam um segredo do Vault chamado `velt_cron_secret`, não `ALTER DATABASE`. O segredo deve ser idêntico a `CRON_SECRET` no ambiente protegido do servidor. O comando do job consulta o Vault na execução e não contém o valor em texto.

- `velt-scheduler-tick`: a cada minuto, `POST /api/public/cron/scheduler-tick`.
- `velt-analytics-sync`: a cada 6 horas, `POST /api/public/cron/analytics-sync`.

Um HTTP 200 sem canais ou jobs não valida publicação nem coleta real. O primeiro disparo automático de analytics não foi comprovado na auditoria inicial.

Há uma limitação histórica de instalação: uma migration antiga tenta `ALTER TABLE` em tabela de Realtime que pertence ao Supabase. No provisionamento atual foi omitida somente essa instrução redundante, após confirmar que RLS já estava habilitada. A instalação limpa de todas as migrations pelo CLI ainda precisa de uma homologação específica. Não altere ownership para contornar isso.

## Checklist antes de distribuir a clientes

- [ ] Executar regressão pós-deploy, sem workarounds, em produção e em homologação isolada.
- [ ] Sincronizar o código entregue com o GitHub e confirmar que um deploy normal do repositório reproduz a mesma versão.
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
