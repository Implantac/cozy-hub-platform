import { Trash2 } from "lucide-react";
import type { Brand } from "@/lib/api/_types";

type Props = {
  brands: Brand[];
  canDelete: boolean;
  isDeleting: boolean;
  onDelete: (id: string) => void;
};

export function BrandGrid({ brands, canDelete, isDeleting, onDelete }: Props) {
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {brands.map((b) => (
        <div key={b.id} className="section-card hover-lift p-5 sm:p-6 group">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-foreground group-hover:text-primary transition-colors">{b.name}</h3>
            <button
              type="button"
              aria-label={`Delete brand ${b.name}`}
              onClick={() => onDelete(b.id)}
              disabled={!canDelete || isDeleting}
              className="text-muted-foreground hover:text-destructive disabled:opacity-50"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {b.description ?? "—"}
          </p>
        </div>
      ))}
    </div>
  );
}
