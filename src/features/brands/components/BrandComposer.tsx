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
    <div className="section-card p-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.length >= 2) onSubmit();
        }}
        className="grid gap-3 md:grid-cols-[1fr_2fr_auto]"
      >
        <input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Brand name"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <input
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Description (optional)"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <button
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="size-4" /> Criar
        </button>
      </form>
    </div>
  );
}
