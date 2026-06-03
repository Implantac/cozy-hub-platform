import { FileText, Plus, Search } from "lucide-react";
import { EmptyState } from "@/components/app/EmptyState";

export function ContentEmptyAll() {
  return (
    <EmptyState
      variant="card"
      icon={FileText}
      title="Sem conteúdo ainda"
      text="Crie seu primeiro rascunho acima. O scheduler vai publicar nos canais conectados quando estiver pronto."
      action={
        <button
          onClick={() => {
            document.querySelector<HTMLInputElement>('input[placeholder*="title"], input[placeholder*="Title"]')?.focus();
          }}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="size-4" /> Criar primeiro rascunho
        </button>
      }
    />
  );
}

export function ContentEmptyFiltered({ onClear }: { onClear: () => void }) {
  return (
    <EmptyState
      variant="dashed"
      icon={Search}
      title="Nada encontrado"
      text="Nenhum conteúdo bate com seus filtros atuais."
      action={
        <button
          onClick={onClear}
          className="inline-flex items-center gap-2 rounded-md bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/80"
        >
          Limpar filtros
        </button>
      }
    />
  );
}
