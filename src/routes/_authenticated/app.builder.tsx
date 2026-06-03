import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Rocket } from "lucide-react";
import { PageTransition, fadeUp, stagger } from "@/components/app/Motion";
import { PageHeader } from "@/components/app/PageHeader";
import { BuilderService } from "@/lib/services";
import { useCurrentWorkspaceId } from "@/lib/workspace/use-workspace";
import { toast } from "sonner";
import { BLOCKS, type BlockId, type Blueprint } from "@/features/builder/constants";
import { BlockEditor } from "@/features/builder/components/BlockEditor";
import { BlockList, BlueprintSummary } from "@/features/builder/components/BlockList";

export const Route = createFileRoute("/_authenticated/app/builder")({
  component: BusinessBuilderPage,
});

function BusinessBuilderPage() {
  const [wsId] = useCurrentWorkspaceId();
  const qc = useQueryClient();
  const get = useServerFn(BuilderService.getBlueprint);
  const update = useServerFn(BuilderService.updateBlueprintBlock);

  const q = useQuery({
    queryKey: ["blueprint", wsId],
    queryFn: () => get({ data: { workspaceId: wsId! } }) as Promise<Blueprint | null>,
    enabled: !!wsId,
  });

  const [active, setActive] = useState<BlockId>("problem");
  const [draft, setDraft] = useState("");

  useEffect(() => { setDraft((q.data?.[active] ?? "") as string); }, [active, q.data]);

  const mut = useMutation({
    mutationFn: (p: { field: BlockId; value: string }) =>
      update({ data: { workspaceId: wsId!, field: p.field, value: p.value } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["blueprint", wsId] }); toast.success("Bloco salvo"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const data = q.data ?? {};
  const filled = BLOCKS.filter((b) => ((data[b.id] ?? "") as string).trim().length > 0).length;
  const total = BLOCKS.length;
  const progress = Math.round((filled / total) * 100);
  const dirty = draft !== ((data[active] ?? "") as string);

  return (
    <PageTransition>
      <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">
        <PageHeader
          icon={Rocket}
          eyebrow="Builder · construa o modelo"
          title="Business Builder"
          subtitle="10 blocos. 10 decisões. Um modelo de negócio que cabe em uma página."
          action={
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Completo</div>
              <div className="text-2xl font-bold tabular-nums">{filled}/{total}</div>
            </div>
          }
        />

        <motion.div variants={fadeUp} className="h-2 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-gradient-brand transition-all" style={{ width: `${progress}%` }} />
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-[1fr,1.5fr]">
          <BlockList data={data} active={active} setActive={setActive} />

          <motion.section variants={fadeUp}>
            <BlockEditor
              block={BLOCKS.find((b) => b.id === active)!}
              value={draft}
              onChange={setDraft}
              dirty={dirty}
              saving={mut.isPending}
              onSave={() => mut.mutate({ field: active, value: draft })}
            />
            <BlueprintSummary data={data} />
          </motion.section>
        </div>
      </motion.div>
    </PageTransition>
  );
}
