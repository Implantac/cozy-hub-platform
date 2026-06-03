import { Plus } from "lucide-react";

type Props = {
  title: string;
  onTitleChange: (v: string) => void;
  onSubmit: () => void;
};

export function MissionComposer({ title, onTitleChange, onSubmit }: Props) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (title.length >= 2) onSubmit();
      }}
      className="flex gap-2"
    >
      <input
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="New mission..."
        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      <button className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
        <Plus className="size-4" />Add
      </button>
    </form>
  );
}
