# Plano de melhorias e correções — VELT

**Atualizado:** 11/11/2026
**Base:** branch `main`, commit `9c1225f`
**Objetivo:** reduzir risco de publicação não autorizada e de abuso de rede, tornar as verificações repetíveis e fechar lacunas de operação sem ampliar o escopo funcional.

## Resumo de execução

### Aplicado neste changeset

- [x] Cron não aceita mais a chave publicável/anon: exige `x-cron-secret` exclusivo com pelo menos 32 caracteres.
- [x] Ambos os endpoints de cron falham fechado se o segredo não estiver configurado e não retornam detalhes internos de erro ao chamador.
- [x] Migrations de atualização reconfigura o cron de analytics para usar o segredo dedicado; se não houver segredo, desativa esse agendamento.
- [x] Validação de mídia rejeita IPs literais, nomes locais, credenciais embutidas e portas HTTPS não padrão.
- [x] Downloads server-side de YouTube, TikTok e LinkedIn recusam redirects e limitam tempo e bytes enquanto leem o corpo.
- [x] Guard de ambiente bloqueia também nomes conhecidos de segredos server-side em arquivos de ambiente versionados.
- [x] Node mínimo alinhado para 22.13+; workflow de CI executa `npm run verify` e auditoria de dependências de produção.
- [x] Testes unitários adicionados para autenticação cron e downloads de mídia.

### Ainda exige configuração fora do repositório

- [ ] Gerar um `CRON_SECRET` forte e configurá-lo **somente** no ambiente protegido do servidor.
- [ ] Configurar o mesmo valor como `app.settings.cron_secret` no banco, aplicar a migration `20261111090000_cron_secret_only.sql` e confirmar que `velt-analytics-sync` aparece uma única vez no pg_cron.
- [ ] Atualizar o cron externo/operacional de `scheduler-tick` para enviar `x-cron-secret`; a migration anterior só agenda a coleta de analytics.
- [ ] Validar que chamadas sem segredo retornam 401, segredo ausente/curto retorna 503 e a execução agendada autorizada funciona.
- [ ] Configurar egress da infraestrutura para negar loopback, endereços privados, link-local e endpoints de metadata. As verificações na aplicação reduzem o risco, mas não eliminam DNS rebinding.

## Validação local desta rodada

- Node 22.13.0: `npm run verify` passou — typecheck, lint, **339 testes em 32 arquivos** e build Nitro; o guard de ambiente também passou.
- `npm audit --omit=dev --audit-level=moderate` passou com zero vulnerabilidades de produção.
- O sandbox tem 1,9 GiB de RAM: sem memória adicional, o bundling Nitro dos 2.260 módulos excede o heap disponível. Para concluir a verificação, habilitei temporariamente 1,5 GiB de swap; a compilação terminou com sucesso. O arquivo de swap foi removido ao final.
- O workflow de CI foi configurado, mas ainda não foi executado no remoto. Não há alterações experimentais de build mantidas no código.

## Próximas etapas

### P1 — Segurança e publicação confiável

- [ ] Completar testes de integração dos endpoints de cron, incluindo execução com segredo válido e erro interno sem efeitos colaterais.
  - [x] Smoke test HTTP local: os dois endpoints retornam 405 em GET; POST sem segredo, com segredo incorreto ou só com `apikey` retorna 401. Nenhuma tarefa foi executada.
  - [x] Testes unitários cobrem segredo ausente/curto (503), sucesso autenticado e resposta 500 sem detalhes internos.
- [ ] Criar testes com Supabase local para RLS de dois workspaces, callback OAuth, reserva/retentativa de jobs e mudança de role.
- [ ] Definir política de allowlist de mídia (por exemplo, bucket/CDN aprovado por workspace) se os requisitos do produto permitirem.
- [ ] Revisar limites e tipos dos uploads aceitos por cada plataforma; manter controles de timeout, tamanho, MIME e extensão coerentes.
- [ ] Fazer scanner de segredos no histórico completo do Git antes de tratar o repositório como livre de credenciais históricas; revogar/rotacionar qualquer segredo identificado.

### P2 — Operação e manutenção

- [ ] Definir Supabase CLI como fonte única de migrations, ou preencher o schema Drizzle e automatizar uma verificação de paridade. Hoje `drizzle/schema.ts` está vazio e há diretórios de migration distintos.
- [ ] Adicionar smoke tests pós-deploy para login, leitura RLS, página pública de bio e endpoints de cron.
- [ ] Migrar gradualmente os `createServerFn().inputValidator()` restantes para `.validator()` e remover os avisos de depreciação do build.
  - [x] Função pública de bio migrada para `.validator()`; outros call sites seguem pendentes.
- [ ] Adicionar métricas/alertas de jobs parados, falhas de refresh OAuth, quotas de provedores e atraso de coleta de analytics.
- [ ] Monitorar relatório CSP em produção e, após validar hosts legítimos, ativar `CSP_MODE=enforce` por ambiente.

### P3 — Produto e experiência

- [ ] Medir a jornada de ativação: workspace criado → canal conectado → primeiro conteúdo publicado → primeira métrica sincronizada → retorno na semana seguinte.
- [ ] Priorizar melhorias por uso e retenção, não por número de telas; simplificar navegação para o fluxo central de conteúdo e crescimento.
- [ ] Manter Commerce Hub oculto até existir um fluxo funcional; não ampliar redes sociais sem concluir aprovação e suporte operacional.
- [ ] Revisar o Studio local com usuários e definir se fica como ferramenta local experimental ou se merece uma arquitetura de processamento hospedada.

## Critérios de conclusão do ciclo

1. `npm run verify` passa no Node 22.13+ no CI.
2. `npm audit --omit=dev --audit-level=moderate` passa.
3. Nenhum endpoint de cron aceita chave publicável, token de usuário ou origem não autenticada como substituto do segredo.
4. Downloads de mídia têm limite de tempo/tamanho e a infraestrutura bloqueia acesso a ranges privados.
5. Migrations aplicam em banco limpo e atualização de banco existente produz o mesmo schema e agendamentos esperados.
6. Ao menos os fluxos críticos de autenticação, RLS, cron e publicação têm testes de integração.
