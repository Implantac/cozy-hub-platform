import { BadgeCheck, Loader2, Sparkles, Wand2 } from "lucide-react";
import { motion } from "framer-motion";
import { fadeUp } from "@/components/app/motion-presets";
import type { useCoach } from "../hooks/useCoach";

/**
 * AI coach card.
 *
 * The card is deliberately quiet until asked. Three product decisions show up
 * here:
 *
 *  1. **Explicit trigger.** No auto-run on typing. A model call per keystroke
 *     would be indefensible on cost and would make the panel flicker.
 *  2. **Proof, not promise.** Each suggestion shows the score the deterministic
 *     engine gave the *rewritten* text — not the model's opinion of its own work.
 *     "Sem impedimentos" / "+N pontos" is a claim VELT can defend.
 *  3. **Honest absence.** Without a key, the card says the layer is off instead
 *     of showing a spinner that never resolves or, worse, a generic tip dressed
 *     up as AI output.
 */
export function CoachCard({
  coach,
  onUseSuggestion,
}: {
  coach: ReturnType<typeof useCoach>;
  onUseSuggestion: (text: string) => void;
}) {
  const { result, pending, error, canRun, request, reset } = coach;

  return (
    <motion.aside variants={fadeUp} className="section-card space-y-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-accent" />
          <h3 className="text-sm font-semibold">Reescrita com IA</h3>
        </div>
        {result?.source === "ai" && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
            verificada
          </span>
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        A IA propõe uma nova legenda. O motor determinístico reescreve nada: ele{" "}
        <span className="text-foreground/80">confere</span> se a proposta realmente elimina o
        problema diagnosticado. Sugestão que não passa é descartada.
      </p>

      {!result && !pending && (
        <button
          type="button"
          onClick={() => (canRun ? request() : undefined)}
          disabled={!canRun}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2 text-xs font-medium transition hover:border-primary/50 hover:bg-secondary/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Wand2 className="size-3.5" />
          {canRun ? "Pedir reescritas" : "Escreva ao menos uma frase"}
        </button>
      )}

      {pending && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> Propondo e verificando…
        </div>
      )}

      {error && (
        <p className="text-[11px] text-destructive">
          A camada de IA não respondeu. O diagnóstico acima continua válido.
        </p>
      )}

      {result && !pending && (
        <div className="space-y-2">
          {result.skippedReason === "no_key" && (
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              A IA está desligada neste ambiente (sem <code>LOVABLE_API_KEY</code>). As regras
              determinísticas acima continuam ativas.
            </p>
          )}

          {result.skippedReason === "model_failed" && (
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {result.retryInSeconds
                ? `Muitos pedidos em pouco tempo. Tente de novo em ${result.retryInSeconds}s.`
                : "O modelo não respondeu. O diagnóstico determinístico continua válido."}
            </p>
          )}

          {result.skippedReason === "all_rejected" && result.suggestions.length === 0 && (
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {result.issueIds.length === 0
                ? "Nada a corrigir: nenhum problema de texto foi diagnosticado neste rascunho."
                : "As propostas do modelo não passaram na verificação — nenhuma elimina de fato o problema citado. É melhor não sugerir do que sugerir errado."}
            </p>
          )}

          {result.suggestions.map((s, i) => (
            <button
              key={`${s.addresses}-${i}`}
              type="button"
              onClick={() => onUseSuggestion(s.body)}
              className="group w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-left transition hover:border-primary/50 hover:bg-secondary/40"
            >
              <div className="mb-1 flex items-center gap-1.5">
                <BadgeCheck className="size-3 text-emerald-500" />
                <span className="text-[10px] font-medium uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                  corrige {s.addresses.replace("hook.", "")}
                </span>
                <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
                  score {s.score}
                </span>
              </div>
              <p className="line-clamp-3 text-xs leading-snug text-foreground group-hover:text-primary">
                {s.body}
              </p>
              {s.rationale && (
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {s.rationale}
                </p>
              )}
            </button>
          ))}

          <button
            type="button"
            onClick={reset}
            className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
          >
            Pedir de novo
          </button>
        </div>
      )}
    </motion.aside>
  );
}
