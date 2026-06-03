import { useState } from "react";
import { X } from "lucide-react";
import { Field } from "./atoms";
import type { CompetitorInput } from "../types";

interface NewCompetitorDialogProps {
  onClose: () => void;
  onSave: (data: CompetitorInput) => void;
  saving: boolean;
}

export function NewCompetitorDialog({ onClose, onSave, saving }: NewCompetitorDialogProps) {
  const [form, setForm] = useState({
    name: "", handle: "", followers: 0, engagement: 0,
    trend: "flat" as "up" | "down" | "flat",
    threat: "medium" as "high" | "medium" | "low",
    positioning: "", recent_move: "", gap: "",
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-elevated" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Novo concorrente</h3>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (!form.name.trim()) return; onSave(form); }} className="space-y-3">
          <Field label="Nome *"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Handle"><input value={form.handle} onChange={(e) => setForm({ ...form, handle: e.target.value })} placeholder="@..." className="input" /></Field>
            <Field label="Seguidores"><input type="number" min={0} value={form.followers} onChange={(e) => setForm({ ...form, followers: Number(e.target.value) })} className="input" /></Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Engajamento %"><input type="number" min={0} max={100} step={0.1} value={form.engagement} onChange={(e) => setForm({ ...form, engagement: Number(e.target.value) })} className="input" /></Field>
            <Field label="Tendência">
              <select value={form.trend} onChange={(e) => setForm({ ...form, trend: e.target.value as "up" | "down" | "flat" })} className="input">
                <option value="up">Subindo</option><option value="flat">Estável</option><option value="down">Caindo</option>
              </select>
            </Field>
            <Field label="Ameaça">
              <select value={form.threat} onChange={(e) => setForm({ ...form, threat: e.target.value as "high" | "medium" | "low" })} className="input">
                <option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option>
              </select>
            </Field>
          </div>
          <Field label="Posicionamento"><textarea rows={2} value={form.positioning} onChange={(e) => setForm({ ...form, positioning: e.target.value })} className="input resize-none" /></Field>
          <Field label="Movimento recente"><textarea rows={2} value={form.recent_move} onChange={(e) => setForm({ ...form, recent_move: e.target.value })} className="input resize-none" /></Field>
          <Field label="Seu gap"><textarea rows={2} value={form.gap} onChange={(e) => setForm({ ...form, gap: e.target.value })} className="input resize-none" /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-gradient-brand px-4 py-2 text-sm font-medium text-primary-foreground shadow-glow disabled:opacity-60">
              {saving ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </form>
        <style>{`.input{width:100%;border-radius:.5rem;border:1px solid hsl(var(--border));background:hsl(var(--background)/.6);padding:.5rem .75rem;font-size:.875rem;outline:none}.input:focus{border-color:hsl(var(--primary)/.4);box-shadow:0 0 0 2px hsl(var(--primary)/.2)}`}</style>
      </div>
    </div>
  );
}
