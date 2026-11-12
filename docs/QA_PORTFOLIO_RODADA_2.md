# QA — portfólio VELT, segunda rodada

Data: 12/11/2026. Base da implementação: `5343f2a004cf5a36bf16264edefddd5f337ffb2f`. Repositório: `Implantac/velt-hub-platform`.

Este registro descreve **validação local**, inclusive do artefato compilado para Vercel. Não comprova sincronização, CI remoto ou promoção de deploy. Essas etapas devem ser confirmadas separadamente, com o SHA correspondente.

## Escopo

Perfil, consulta de equipe, leitura de análises e requisitos de coleta, configurações móveis, pt-BR/en-US, acessibilidade selecionada, downloads e recuperação de falhas. Não houve nova migration ou alteração de políticas RLS, credenciais de provedores, automações ou configuração de deploy. O CI continua paralelo ao deploy, não condiciona sua promoção.

## Resultado local

| Verificação                                         | Resultado                                                                                                                |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Node                                                | 22.13.0                                                                                                                  |
| `npm run typecheck`                                 | Aprovado                                                                                                                 |
| `npm run lint`                                      | Aprovado                                                                                                                 |
| `npm test`                                          | 444 testes em 43 arquivos aprovados                                                                                      |
| `npm audit --omit=dev --audit-level=moderate`       | Zero vulnerabilidades reportadas na execução                                                                             |
| `npm run env:check`                                 | Aprovado                                                                                                                 |
| `NITRO_PRESET=vercel npm run build`                 | Aprovado, com apoio temporário de swap neste sandbox                                                                     |
| Navegador sobre o build compilado                   | 19 verificações aprovadas: 15 da jornada e 4 complementares                                                              |
| Axe sobre o build compilado                         | 9 estados sem violações detectadas nas regras selecionadas                                                               |
| Erros JavaScript de página                          | Nenhum nas duas jornadas finais                                                                                          |
| Credencial privilegiada conhecida no bundle público | Nenhuma correspondência, em 129 arquivos / 2.138.028 bytes                                                               |
| Limpeza final                                       | 1 usuário real e 1 workspace real preservados; nenhum usuário `qa-round2-` restante; 0 canais, 0 conteúdos e 0 snapshots |

O scan de credencial usa correspondência exata de **um** valor privilegiado disponível à sessão, somente nos assets públicos gerados. Não é um scanner genérico, do histórico Git ou de todas as possíveis credenciais.

### Limite de memória do ambiente local

O sandbox tem aproximadamente 1,9 GiB de RAM, sem swap por padrão. O build padrão e a tentativa com preset Vercel foram encerrados pelo OOM killer; uma tentativa limitada a 1.100 MiB de heap também não concluiu. Isso não foi registrado como build aprovado.

O build final usou **o comando normal de produção**, Node 22.13.0, heap de 4 GB definido em `package.json` e preset Vercel, com 1,5 GiB de swap temporário no sandbox. Concluiu com sucesso. O swap foi desligado e seu arquivo removido; nenhuma mudança de heap, plugin, dependência ou infraestrutura de produção foi feita nesta rodada para contornar o problema.

Uma execução adicional de lint depois do build encontrou outro problema de ferramentas: `.vercel/output` não estava na lista de outputs ignorados, e a análise dos bundles gerados não concluiu no timeout de 120 segundos. A execução foi encerrada e esse diretório gerado foi adicionado aos ignores, sem reduzir regras de análise do código-fonte. O lint foi repetido após a correção com os artefatos presentes.

O artefato `.vercel/output` foi servido localmente pelo `srvx`, com os assets estáticos e o handler compilado, sem Vite HMR. Essa execução não emula todos os limites e serviços da plataforma Vercel. Permanecem avisos conhecidos de `.inputValidator()` depreciado e de diretivas `use client` de dependências no build.

## Jornada principal: 15 verificações

1. Perfil carrega o nome já salvo e usa a consulta compartilhada por usuário.
2. Nome vazio ou composto somente por espaços é inválido e não pode ser salvo.
3. Save real confirma o nome aparado no banco e atualiza o menu da conta imediatamente.
4. Nome persiste em três recargas consecutivas na execução sobre o build.
5. Equipe mostra o nome atualizado e o papel traduzido, sem prometer convites.
6. Perfil/equipe cabem em 320, 360 e 390 px; as abas têm pelo menos 44 px de altura.
7. Workspace real vazio informa ausência de canais e não permite disparar coleta.
8. Período usa radios nativos, clique no rótulo e navegação com setas.
9. PDF/CSV autenticados são baixados do endpoint real e contêm o relatório do workspace vazio, sem inventar desempenho.
10. Falha HTTP de relatório informa erro, não inicia download e libera o botão.
11. Análises cabem em 360 px, sem overflow horizontal da página.
12. Falhas independentes de resumo e readiness mostram erros/retries próprios; não aparecem como ausência bem-sucedida de métricas.
13. Falha de leitura da equipe oferece nova tentativa e não aparece como equipe vazia.
14. Falha no refresh do perfil não desmonta a aplicação; rascunho não salvo sobrevive ao erro e ao retry.
15. Contexto novo de navegador em en-US mostra configurações/análises/papéis/período traduzidos em 390 px.

A jornada principal também registrou zero erros inesperados de console. Falhas HTTP intencionais são classificadas à parte: são interceptações somente no navegador, não incidentes reais do servidor ou de produção.

## Complementos: 4 verificações

1. POST de atualização do perfil com 503 injetado preserva rascunho e nome no banco. Retirando a falha, o retry salva de verdade somente o perfil autenticado; o segundo usuário temporário permanece inalterado.
2. Uma membership temporária `viewer`, criada somente para QA, confirma a privacidade existente: o perfil do outro membro não é exposto ao chamador e a equipe mostra fallback/papel traduzidos. Não foi criada uma policy de visibilidade adicional.
3. Requisições reais autenticadas de leitura de detalhes e readiness, repetidas com o ID do outro workspace temporário, são recusadas. O teste cobre apenas essas duas leituras, não todos os endpoints, papéis ou recursos.
4. Resposta HTTP 200 com MIME incorreto e PDF vazio é rejeitada, sem download e sem mensagem de sucesso.

## Acessibilidade selecionada

Axe foi executado com as tags `wcag2a`, `wcag2aa` e `wcag21aa` nos seguintes estados: perfil desktop, equipe desktop, configurações mobile, análises vazias desktop/mobile, erros de leitura de análises, erro de equipe, análises mobile em inglês e equipe com perfil privado. Nenhuma violação foi detectada nesses nove estados.

Tabelas equivalentes aos gráficos e formatação de dados preenchidos têm regressões de renderização unitárias. Não houve coleta real para preencher gráficos no navegador. Esse escopo não certifica WCAG, uso completo por leitor de tela, todos os diálogos ou todos os dados possíveis.

## Diagnósticos durante o desenvolvimento

- O navegador reproduziu a falha de equipe `PGRST200`: não existe relacionamento de `workspace_members` para `profiles`. A correção usa duas leituras sob RLS do chamador, sem service role no handler e sem migration.
- Uma execução de desenvolvimento apresentou página vazia após reload, sem erro JavaScript de página registrado. A causa não foi estabelecida; não foi atribuída automaticamente ao HMR. O cenário não reapareceu nas execuções estáveis seguintes, inclusive nas três recargas consecutivas do build compilado. Isso não demonstra a impossibilidade de uma falha intermitente futura.
- Duas interrupções posteriores foram do próprio harness: clique direto em radio visualmente oculto, em vez de seu rótulo, e evento de visibilidade enviado ao alvo errado. O script foi corrigido para clique no rótulo/foco/teclado e evento no `window`, sem alterar a aplicação para forçar sucesso.

## Segurança dos dados de QA

Login real, sem inserir sessão no storage. Usuários com endereço reservado `example.invalid`, workspaces próprios, senha aleatória só em memória e configuração privilegiada fora do repositório, em diretório privado. A credencial administrativa foi usada apenas no provisionamento, conferência e limpeza dessas fixtures; handlers da aplicação usam o cliente autenticado do chamador.

Após cada execução, os workspaces de QA e os usuários temporários foram removidos, com conferência de ausência. A jornada complementar removeu também sua membership por exclusão do workspace. O owner/workspace reais foram preservados. Nenhum canal social foi conectado, nenhum provedor de métricas foi chamado e nenhum conteúdo foi criado ou publicado. Loja e Lotofacil não foram usados nos testes.

## Limites preservados

- A agregação continua somando snapshots; o aviso sobre valores cumulativos repetidos **não é deduplicação**, alcance único ou crescimento incremental.
- Um coletor implementado não comprova OAuth, refresh de token, quotas ou aprovação externa. TikTok e Google Business continuam sem coletor de insights nesta versão.
- Relatórios do workspace vazio não homologam números de uma operação com publicações reais. Os arquivos continuam em português e o envio automático de e-mail não está configurado.
- Os 15 testes unitários de handlers usam contexto autenticado mockado; não substituem Auth ou Postgres/RLS. As duas leituras reais de isolamento complementam, mas não completam, a revisão multi-cliente.
- A liberação comercial continua dependendo do checklist em [PORTFOLIO_E_CLIENTES.md](./PORTFOLIO_E_CLIENTES.md).

## Evidências operacionais

Na entrega da sessão, fora do repositório e sem credenciais: `browser-production-build/result.json`, `browser-edge-build/result.json`, capturas correspondentes, `typecheck-final.log`, `lint-final.log`, `tests-final.log`, `audit-final.log`, `build-vercel-final.log`, `build-swap.log`, `database-final-counts.json` e `public-bundle-scan.json`.

Resultados de tentativas interrompidas foram mantidos separados dos resultados finais. Não se somam tentativas repetidas como se fossem verificações únicas aprovadas. Snapshots locais e logs não são prova de deploy remoto; confira SHA/estado do deploy e smoke pós-publicação separadamente.
