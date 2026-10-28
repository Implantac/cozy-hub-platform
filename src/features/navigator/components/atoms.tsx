import { motion } from "framer-motion";
import { Compass } from "lucide-react";
import { fadeUp } from "@/components/app/Motion";
import { PageHeader } from "@/components/app/PageHeader";

export function NavigatorHeader() {
  return (
    <PageHeader
      icon={Compass}
      eyebrow="Digital Navigator"
      title="Seu caminho de crescimento"
      subtitle="Diagnóstico inteligente para gerar seu plano de ação personalizado."
    />
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-6 text-xl font-medium">{children}</h2>;
}

export function ChoiceCard({
  active,
  onClick,
  label,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  desc: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl border p-4 transition ${
        active
          ? "border-primary bg-primary/10 shadow-glow"
          : "border-border bg-background/40 hover:border-primary/40"
      }`}
    >
      <div className="font-medium">{label}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{desc}</div>
    </button>
  );
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-4 py-1.5 text-sm transition ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background/40 text-foreground hover:border-primary/40"
      }`}
    >
      {children}
    </button>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <motion.div variants={fadeUp} className="section-card p-5">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
    </motion.div>
  );
}
