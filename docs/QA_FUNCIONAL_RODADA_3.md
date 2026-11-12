# VELT — integridade funcional, rodada 3

Data: 12/11/2026. Escopo: VELT e seu Supabase exclusivo. Loja, Lotofacil e os dados do owner/workspace reais não foram alterados. O owner é o proprietário do workspace, não um superusuário do Supabase.

**Resultado local:** verificações abaixo aprovadas. Isso não é homologação externa, pentest, certificação WCAG ou declaração de que o sistema inteiro está “100% funcional”. Publicação remota, SHA do deploy, CI e smoke pós-deploy devem ser conferidos separadamente no registro operacional da entrega. O deploy continua limitado ao `main`; o CI continua paralelo, sem gate novo.

## Correções entregues

### Persistência e recuperação

- Editor real de conteúdo: título, texto e referências HTTPS de mídia. Criar/editar exige confirmação do servidor; falhas preservam o formulário. A biblioteca aceita até 20 URLs para organização; o agendamento atual aceita um anexo, não carrossel. Não é upload nem confirmação da disponibilidade do arquivo.
- Um erro HTTP não serializado, inclusive `503` com corpo JSON vazio, deixa de poder resolver como resultado vazio de sucesso no transporte de server functions. Rejeições que não são `Error` são normalizadas; alertas/toasts não ficam sem mensagem. Não se repete automaticamente uma mutação cuja confirmação pode ter sido perdida.
- Formulários são remontados por workspace. Invalidação de cache inclui conteúdo, opções de agendamento, fila, canais e métricas relacionados, conforme a operação.

### Permissões e banco

- Leitura para membros; edição de conteúdo/Bio/criação de marca para owner, admin e editor; gerenciamento de canais, exclusão de marca e execução manual da fila para owner/admin. Viewer não recebe permissão de escrita. A UI não substitui as validações da API e RLS.
- Proteção da membership do owner primário, da identidade/ownership do workspace e do plano de cobrança. Conta autenticada não pode se promover a um plano pago.
- FKs compostas impedem referências entre workspaces em marcas, canais, conteúdo, jobs e snapshots. Uma linha não retornada por RLS não é tratada como atualização/exclusão bem-sucedida.
- Estados de entrega não podem ser forjados pelo fluxo editorial/REST autenticado. Conteúdo com publicação pendente/processando não pode ser editado/excluído; um canal com esses jobs não pode ser excluído. A exclusão do workspace continua permitindo seu cascade legítimo.

### Agendamento e resultados

- Agendamento real de conteúdo draft/failed, no futuro, para 1–20 canais distintos do workspace. Validação de mídia/configuração e conexão/token; Google Business exige unidade confirmada. Configuração não comprova autorização vigente no provedor.
- Enqueue/cancelamento atômicos. Cancelar o último job pendente restaura draft sem apagar o conteúdo; cancelar um canal não apaga o agendamento dos outros. Execução manual da fila reclama somente jobs do workspace autorizado.
- Conclusão requer referência externa não vazia; operações de conclusão são idempotentes e falhas tardias não desfazem sucesso. Falhas permanentes e referências upstream conhecidas não geram republicação automática.
- LinkedIn exige a referência real de resposta, sem fallback com horário local. TikTok não apresenta envio para inbox como publicação; exige Direct Post habilitado e ID público confirmado. Google Business distingue aceitação/processamento de publicação visível. Testes desses contratos usam respostas mockadas, não contas reais.
- **Limite importante:** não há reconciliação durável de jobs `processing` com lock expirado. Eles recebem aviso de atenção e não são reclamados automaticamente; referências de tracking/recurso não provam visibilidade pública. Conferir o provedor antes de republicar.

### OAuth, Bio e métricas

- State OAuth assinado, TTL de dez minutos e vínculo ao cookie do navegador; callback verifica novamente papel/workspace/marca e persiste canal/token atomicamente. Não reflete erros do provedor nem tokens na URL. Desconectar remove ciphertext privado. O vínculo do cookie não é consumo atômico de nonce no banco.
- Meta usa versão Graph explícita, padrão `v24.0`, não necessariamente a mais recente. Discovery ambíguo falha fechado em vez de escolher outra conta. Page tokens e refresh seguem tratamento específico; continuam sujeitos à aprovação/homologação do provedor.
- Bio privada permanece privada sob RLS e responde 404 anonimamente. Links `mailto:`/`tel:` validados, append/reorder atômicos, publicação bloqueada com edição não salva e contadores SQL. Despublicar torna página e redirect antigo indisponíveis.
- Analytics/relatórios usam a última coleta cumulativa por conteúdo × canal no período. Coletas repetidas não são somadas. A série diária é o acumulado observado naquela data, não novas interações diárias. Alcance agregado não deduplica pessoas entre canais.
- Leituras de fila, opções e dados analíticos/relatórios são paginadas com ordem estável e limite de segurança explícito; falha em uma página não produz total parcial de sucesso. Exportações mantêm autenticação/RLS, metodologia e proteção CSV contra fórmulas. Arquivos em português; sem envio automático por e-mail.

## Verificações executadas

| Camada                                | Resultado                               | O que comprova — e o que não comprova                                                                                                             |
| ------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck e lint                      | Aprovados                               | Consistência estática; não homologam runtime externo                                                                                              |
| Vitest                                | **712 testes / 56 arquivos**            | Lógica, validações e contratos; vários contextos/provedores são mockados                                                                          |
| Auditoria de dependências de produção | **0 vulnerabilidades reportadas**       | Resultado do lockfile/data da execução, não garantia permanente                                                                                   |
| Build Node 22.13 / Nitro Vercel       | Aprovado                                | Compilação do artefato de produção; não comprova deploy remoto                                                                                    |
| Postgres/RLS real                     | **116/116**                             | 63 integridade + 33 entrega/OAuth + 13 outcomes + 7 ciclo de canal, no schema instalado após as sete migrations; cada suíte com rollback completo |
| Auth + HTTP no build compilado        | **22/22**                               | Sessões reais descartáveis, RLS/tenant, CRUD, concorrência, relatórios, callback inválido, desconexão e fila sem jobs vencidos                    |
| Navegador Chromium no build compilado | **31/31**                               | Formulários, falhas/retry, recargas, horário local→UTC, cancelamento, Bio pública/privada, downloads e owner/admin/editor/viewer                  |
| Axe nos estados selecionados          | **16 análises, 0 violações detectadas** | Inclui diálogo com erro, editor em inglês, formulários preenchidos, Bio pública e RBAC; não é auditoria WCAG completa                             |
| Larguras móveis                       | **320, 360 e 390 px**                   | Sem overflow horizontal nos quatro fluxos selecionados e no editor                                                                                |

As cinco corridas paralelas de enqueue/cancelamento mantiveram um job/um cancelamento por conteúdo. Oito inserts de links Bio concorrentes e dois reorders completos concorrentes preservaram posições únicas e contíguas. Outcomes foram exercitados **somente no banco**, com IDs explicitamente sintéticos e sem chamar dispatcher/provedor.

O cenário analítico inseriu coletas 100 e 120 para o mesmo conteúdo/canal e 90 para outro canal: resultado **210 impressões e 21 engajamentos**, não 310/31. CSV/PDF foram baixados com esses dados sintéticos. Não são números de uma operação real.

## Isolamento dos testes e limpeza

- Cada execução autenticada criou cinco usuários e dois workspaces descartáveis, com remoção confirmada no `finally`. Jobs ficaram pelo menos 30 dias no futuro ou em estados de teste não publicáveis. Nenhum teste inseriu conteúdo nos workspaces reais.
- O servidor local usou build de produção e modo de publisher `real`, mas configuração de app Meta propositalmente inválida, chave OAuth efêmera e bloqueio de fetch para qualquer host externo ao Supabase VELT. A inspeção final registrou **zero tentativas** de fetch externo/provedor. Essa configuração é exclusiva do harness local, não faz parte do deploy.
- Auditoria final: um usuário, um workspace, uma membership real; zero usuários/workspaces QA e zero conteúdo, canais, jobs, tokens, snapshots ou páginas Bio remanescentes. Fingerprints do workspace/membership reais iguais ao preflight. Os dois crons existentes foram preservados.
- Uma asserção de CSV esperava acento em uma metodologia ASCII; foi corrigida no harness. Axe passou a aguardar animações finitas, evitando medir contraste durante o fade. Outra expectativa do harness foi corrigida: editor pode criar marca, mas não excluí-la. Tentativas interrompidas foram preservadas, sem somar suas contagens como resultados únicos.
- Defeitos reais reproduzidos durante a validação: mensagem de erro vazia na edição, transporte HTTP ambíguo e contraste reduzido em rótulos da capacidade de publicação. Corrigidos e incluídos na execução final.

## Migrations desta rodada

Já aplicadas no Supabase VELT, totalizando 27 migrations no ambiente auditado. Não reaplicar manualmente nesse projeto:

1. `20261112200411_workspace_integrity.sql`
2. `20261112200423_bio_contacts_and_ordering.sql`
3. `20261112200437_scheduler_workspace_scope.sql`
4. `20261112202623_delivery_integrity.sql`
5. `20261112202635_oauth_connection_integrity.sql`
6. `20261112203336_scheduler_outcome_integrity.sql`
7. `20261112204808_channel_publication_guard.sql`

As suítes SQL versionadas estão em `supabase/tests/`. Execute-as somente em ambiente autorizado, preservando os `BEGIN`/`ROLLBACK`; o fluxo não chama provedores. Não desative RLS, não altere ownership e não use outro projeto para contornar restrições. Instalação limpa de todas as migrations, backup/restauração e paridade de schema continuam precisando de homologação própria.

## Antes de chamar de “100% funcional”

Faltam ciclos autorizados reais de OAuth/publicação/coleta e seus cenários de expiração, quotas, visibilidade, erro e recuperação, além de SMTP, IA, storage/egress, Realtime, backup/restauração e requisitos legais/operacionais. TikTok continua limitado ao upload de chunk único de até 64 MiB; polling de até um minuto não substitui reconciliação/webhook duráveis. Convites/administração de equipe não existem na tela de consulta. Carrossel/upload de mídia e Commerce Hub não foram implementados por esta rodada.

Nenhuma dessas dependências foi validada por HTTP 200, configuração existente ou fixture sintética. Não conectar redes nem publicar conteúdo real sem autorização específica. A liberação para clientes permanece condicionada ao checklist em [PORTFOLIO_E_CLIENTES.md](./PORTFOLIO_E_CLIENTES.md).
