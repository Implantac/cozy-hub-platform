import { createFileRoute, notFound } from "@tanstack/react-router";
import { ShoppingBag, Package, Globe, Truck, CheckCircle, Lock } from "lucide-react";
import { PageTransition } from "@/components/app/Motion";
import { fadeUp, stagger } from "@/components/app/motion-presets";
import { PageHeader } from "@/components/app/PageHeader";
import { motion } from "framer-motion";
import { isFeatureEnabled } from "@/lib/features/flags";

export const Route = createFileRoute("/_authenticated/app/commerce")({
  /**
   * The flag has to be enforced here too, not only in the navigation.
   *
   * Hiding a link is not hiding a page: the route is public knowledge, people
   * bookmark URLs and share them, and a module we are not shipping should not be
   * reachable by guessing. `notFound()` — not a redirect — because that is the
   * truth from this build's point of view: the page does not exist.
   */
  beforeLoad: () => {
    if (!isFeatureEnabled("commerce")) throw notFound();
  },
  component: CommercePage,
});

const SECTIONS = [
  {
    icon: Package,
    title: "Fornecedores",
    desc: "Catálogo curado de fornecedores nacionais e internacionais.",
    status: "soon",
  },
  {
    icon: Truck,
    title: "Dropshipping",
    desc: "Integração com providers de dropshipping com fulfillment automatizado.",
    status: "soon",
  },
  {
    icon: Globe,
    title: "Marketplaces",
    desc: "Publique e gerencie estoque em múltiplos marketplaces.",
    status: "soon",
  },
  {
    icon: CheckCircle,
    title: "Validação de Produto",
    desc: "Pesquisa de demanda, análise de competição e previsão de margem.",
    status: "soon",
  },
];

function CommercePage() {
  return (
    <PageTransition>
      <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">
        <PageHeader
          icon={ShoppingBag}
          eyebrow="Commerce Hub"
          title="Comércio digital"
          subtitle="Infraestrutura para você vender produtos físicos e digitais em escala."
        />

        <div className="grid gap-4 md:grid-cols-2">
          {SECTIONS.map((s) => (
            <motion.div
              key={s.title}
              variants={fadeUp}
              className="section-card hover-lift group relative overflow-hidden p-6"
            >
              <div className="pointer-events-none absolute -right-12 -top-12 size-32 rounded-full bg-gradient-to-br from-primary/15 to-transparent blur-2xl" />
              <div className="relative flex items-start gap-4">
                <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-gradient-brand shadow-glow">
                  <s.icon className="size-5 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{s.title}</h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                      <Lock className="size-2.5" /> Em breve
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="rounded-2xl border border-dashed border-border bg-card/30 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            A arquitetura do Commerce Hub está pronta. Os módulos serão liberados conforme as
            integrações forem ativadas.
          </p>
        </div>
      </motion.div>
    </PageTransition>
  );
}
