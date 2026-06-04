import { Plus } from "lucide-react";

type Props = {
  name: string;
  description: string;
  isPending: boolean;
  onNameChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onSubmit: () => void;
};

export function BrandComposer({
  name,
  description,
  isPending,
  onNameChange,
  onDescriptionChange,
  onSubmit,
}: Props) {
  return (
    <div className="section-card p-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.length >= 2) onSubmit();
        }}
        className="grid gap-3 md:grid-cols-[1fr_2fr_auto] items-end"
      >
        <input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Brand name"
          className="h-10 w-full rounded-xl border border-input bg-background/50 px-3 py-2 text-sm transition-all focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
        />
        <input
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Description (optional)"
          className="h-10 w-full rounded-xl border border-input bg-background/50 px-3 py-2 text-sm transition-all focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
        />
        <button
          disabled={isPending}
          className="h-10 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-glow-sm hover:bg-primary/90 hover:shadow-glow hover:-translate-y-0.5 active:scale-[0.96] transition-all disabled:opacity-50"
        >
          <Plus className="size-4" /> Criar
        </button>
      </form>
    </div>
  );
}
