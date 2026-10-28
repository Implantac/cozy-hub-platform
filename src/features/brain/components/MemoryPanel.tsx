import { Brain, Plus } from "lucide-react";
import { SectionCard } from "@/components/app/SectionCard";
import type { Memory } from "@/lib/api/_types";
import { MEMORY_KINDS, MEMORY_META, type MemoryKind } from "../constants";

type Props = {
  memories: Memory[];
  memText: string;
  setMemText: (s: string) => void;
  memKind: MemoryKind;
  setMemKind: (k: MemoryKind) => void;
  onSubmit: () => void;
  isPending: boolean;
};

export function MemoryPanel({
  memories,
  memText,
  setMemText,
  memKind,
  setMemKind,
  onSubmit,
  isPending,
}: Props) {
  return (
    <SectionCard className="lg:col-span-2" icon={Brain} title="Camada de memória" dense>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (memText.length >= 2) onSubmit();
        }}
        className="space-y-2"
      >
        <div className="flex flex-wrap gap-1.5">
          {MEMORY_KINDS.map((k) => {
            const meta = MEMORY_META[k];
            const Icon = meta.icon;
            const active = memKind === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setMemKind(k)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background/40 text-muted-foreground hover:border-primary/40"
                }`}
              >
                <Icon className="size-3" /> {meta.label}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2 items-end">
          <input
            value={memText}
            onChange={(e) => setMemText(e.target.value)}
            placeholder="Ex.: Meta de R$ 10k/mês até dezembro..."
            className="h-10 flex-1 rounded-xl border border-input bg-background/50 px-3 py-2 text-sm transition-all focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
          />
          <button
            type="submit"
            disabled={memText.length < 2 || isPending}
            className="h-10 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-glow-sm hover:bg-primary/90 transition-all disabled:opacity-50"
          >
            <Plus className="size-3.5" /> Salvar
          </button>
        </div>
      </form>

      {memories.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-border/70 bg-card/30 py-6 text-center text-xs text-muted-foreground">
          Nenhuma memória registrada ainda.
        </div>
      ) : (
        <ul className="mt-4 space-y-1.5">
          {memories.map((m) => {
            const meta = MEMORY_META[m.kind as MemoryKind] ?? MEMORY_META.fact;
            const Icon = meta.icon;
            return (
              <li
                key={m.id}
                className="flex items-start gap-3 rounded-xl border border-border/50 bg-background/30 p-3 text-sm transition-all hover:border-primary/40 hover:bg-background/50"
              >
                <span
                  className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-background/60 shadow-sm ring-1 ring-border/50 ${meta.color}`}
                >
                  <Icon className="size-3" />
                </span>
                <span className="flex-1 leading-snug">{m.content}</span>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
