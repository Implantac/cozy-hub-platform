import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { OpportunitiesService, BrainCoreService } from "@/lib/services";
import { useCurrentWorkspaceId } from "@/lib/workspace/use-workspace";
import { PageTransition, stagger } from "@/components/app/Motion";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { OpportunityCard } from "@/features/opportunities/components/OpportunityCard";
import { OpportunityStatusFilters } from "@/features/opportunities/components/OpportunityStatusFilters";
import type { OpportunityStatusFilter } from "@/features/opportunities/constants";

export const Route = createFileRoute("/_authenticated/app/opportunities")({
  component: OpportunitiesPage,
});

function OpportunitiesPage() {
  const [wsId] = useCurrentWorkspaceId();
  const [status, setStatus] = useState<OpportunityStatusFilter>(undefined);
  const listGeneric = useServerFn(OpportunitiesService.listOpportunities);
  const listBrain = useServerFn(BrainCoreService.brainOpportunities);
  const q = useQuery({
    queryKey: ["opps", wsId, status],
    queryFn: () =>
      wsId
        ? listBrain({ data: { workspaceId: wsId, status: status as any } })
        : listGeneric({ data: { workspaceId: undefined, status: status as any } }),
  });

  return (
    <PageTransition>
      <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">
        <PageHeader
          icon={Sparkles}
          eyebrow="Opportunity Radar · ranqueado pelo USE Brain"
          title="Oportunidades de mercado"
          subtitle="Nichos emergentes e tendências, ordenados pela compatibilidade com o seu perfil, canais e objetivos."
        />

        <OpportunityStatusFilters value={status} onChange={setStatus} />

        <motion.div variants={stagger} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(q.data ?? []).map((o: any) => (
            <OpportunityCard key={o.id} o={o} />
          ))}
        </motion.div>

        {q.data && q.data.length === 0 && (
          <EmptyState
            icon={Sparkles}
            title="Nenhuma oportunidade nesse filtro"
            text="Ajuste o filtro acima para explorar outros nichos e tendências."
          />
        )}
      </motion.div>
    </PageTransition>
  );
}
