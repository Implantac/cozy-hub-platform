import type { Mission } from "@/lib/api/_types";
import { MISSION_COLS, type MissionStatus } from "../constants";

type Props = {
  missions: Mission[];
  onMove: (id: string, status: MissionStatus) => void;
};

export function MissionBoard({ missions, onMove }: Props) {
  const byCol = MISSION_COLS.map((s) => ({
    status: s,
    items: missions.filter((m) => m.status === s),
  }));

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {byCol.map((col) => (
        <div key={col.status} className="section-card p-4">
          <h3 className="mb-3 text-sm font-medium capitalize text-muted-foreground">
            {col.status.replace("_", " ")} · {col.items.length}
          </h3>
          <div className="space-y-2">
            {col.items.map((m) => (
              <div
                key={m.id}
                className="hover-lift rounded-lg border border-border bg-background/40 p-3 text-sm"
              >
                <div className="font-medium">{m.title}</div>
                <div className="mt-2 flex gap-1 text-xs">
                  {MISSION_COLS.filter((s) => s !== m.status).map((s) => (
                    <button
                      key={s}
                      onClick={() => onMove(m.id, s)}
                      className="rounded-md bg-secondary px-2 py-1 capitalize hover:bg-primary hover:text-primary-foreground"
                    >
                      → {s.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {col.items.length === 0 && <p className="text-xs text-muted-foreground">Vazio</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
