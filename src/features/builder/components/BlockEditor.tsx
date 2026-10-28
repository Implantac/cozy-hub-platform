import { Sparkles } from "lucide-react";
import type { Block } from "../constants";

type Props = {
  block: Block;
  value: string;
  onChange: (v: string) => void;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
};

export function BlockEditor({ block, value, onChange, dirty, saving, onSave }: Props) {
  const Icon = block.icon;
  return (
    <div className="section-card p-6">
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-xl bg-gradient-brand text-primary-foreground shadow-glow">
          <Icon className="size-5" />
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {block.category}
          </div>
          <div className="text-lg font-semibold">{block.label}</div>
        </div>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{block.question}</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        placeholder="Escreva em uma ou duas frases. Clareza vence completude."
        className="mt-3 w-full resize-none rounded-xl border border-border bg-background/60 p-4 text-sm leading-relaxed outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
      />
      <div className="mt-3 flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Sparkles className="size-3 text-accent" /> Dica: comece pelo problema.
        </span>
        <button
          onClick={onSave}
          disabled={!dirty || saving}
          className="rounded-lg bg-gradient-brand px-4 py-2 text-xs font-medium text-primary-foreground shadow-glow transition disabled:opacity-50"
        >
          {saving ? "Salvando…" : dirty ? "Salvar bloco" : "Salvo"}
        </button>
      </div>
    </div>
  );
}
