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

export function MemoryPanel({ memories, memText, setMemText, memKind, setMemKind, onSubmit, isPending }: Props) {
  return (
    <SectionCard className="lg:col-span-2" icon={Brain} title="Camada de memória">
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
        <div className="flex gap-2">
          <input
            value={memText}
            onChange={(e) => setMemText(e.target.value)}
            placeholder="Ex.: Meta de R$ 10k/mês até dezembro..."
            className="flex-1 rounded-lg border border-input bg-background/40 px-3 py-2 text-sm transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={memText.length < 2 || isPending}
            className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
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
                className="flex items-start gap-2 rounded-lg border border-border bg-background/40 p-2.5 text-sm transition hover:border-primary/40"
              >
                <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-background/60 ${meta.color}`}>
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
