import { readMilestones } from "@/lib/json";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { GraduationCap, Check } from "lucide-react";
import { toast } from "sonner";
import { LearningService } from "@/lib/services";
import { PageTransition } from "@/components/app/Motion";
import { fadeUp, stagger } from "@/components/app/motion-presets";
import { PageHeader } from "@/components/app/PageHeader";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_authenticated/app/learning")({
  component: LearningPage,
});

function LearningPage() {
  const qc = useQueryClient();
  const listPaths = useServerFn(LearningService.listLearningPaths);
  const listProgress = useServerFn(LearningService.listMyProgress);
  const toggle = useServerFn(LearningService.toggleMilestone);

  const paths = useQuery({ queryKey: ["learning-paths"], queryFn: () => listPaths() });
  const progress = useQuery({ queryKey: ["learning-progress"], queryFn: () => listProgress() });
  const mut = useMutation({
    mutationFn: (v: { pathId: string; milestoneId: string }) => toggle({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["learning-progress"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const progressMap = new Map((progress.data ?? []).map((p) => [p.path_id, p]));

  return (
    <PageTransition>
      <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">
        <PageHeader
          icon={GraduationCap}
          eyebrow="Learning Paths"
          title="Trilhas guiadas de crescimento"
          subtitle="Jornadas com milestones claros. Avance no seu ritmo."
        />

        <div className="grid gap-4 lg:grid-cols-2">
          {(paths.data ?? []).map((p) => {
            const prog = progressMap.get(p.id);
            const completed: string[] = prog?.completed_milestones ?? [];
            const pct = prog?.progress_pct ?? 0;
            return (
              <motion.div key={p.id} variants={fadeUp} className="section-card hover-lift p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium">{p.title}</h3>
                    {p.description && (
                      <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
                    )}
                  </div>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                    {p.difficulty === "beginner"
                      ? "Iniciante"
                      : p.difficulty === "intermediate"
                        ? "Intermediário"
                        : "Avançado"}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{pct}% concluído</span>
                  <span>·</span>
                  <span>~{p.estimated_hours}h</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6 }}
                    className="h-full rounded-full bg-gradient-brand"
                  />
                </div>
                <ul className="mt-4 space-y-2">
                  {readMilestones(p.milestones).map((m) => {
                    const done = completed.includes(m.id);
                    return (
                      <li key={m.id}>
                        <button
                          onClick={() => mut.mutate({ pathId: p.id, milestoneId: m.id })}
                          className={`group flex w-full items-center gap-3 rounded-lg border p-3 text-left text-sm transition ${
                            done
                              ? "border-success/40 bg-success/5"
                              : "border-border bg-background/40 hover:border-primary/40"
                          }`}
                        >
                          <div
                            className={`grid size-5 shrink-0 place-items-center rounded-full border-2 transition ${
                              done
                                ? "border-success bg-success text-success-foreground"
                                : "border-border"
                            }`}
                          >
                            {done && <Check className="size-3" />}
                          </div>
                          <span className={done ? "text-muted-foreground line-through" : ""}>
                            {m.title}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </PageTransition>
  );
}
