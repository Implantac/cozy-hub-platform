import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Brain,
  Sparkles,
  BarChart3,
  Calendar,
  Network,
  Target,
  Layers,
  ArrowRight,
  Compass,
  Rocket,
  Shield,
  Workflow,
  CheckCircle2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VELT — AI-native operating system for your digital presence" },
      {
        name: "description",
        content:
          "Launch, operate and grow your brand across Instagram, Facebook, YouTube, TikTok and LinkedIn.",
      },
    ],
  }),
  component: Landing,
});

/**
 * Reads a feature's `{ title, desc }` pair from the translation files.
 *
 * `returnObjects: true` gives `unknown`, and casting it to `any` meant a missing
 * or renamed key rendered as `undefined` on the marketing page — the first thing
 * a visitor sees. Validating here turns that into empty strings the layout can
 * survive, and keeps the cast out of the component.
 */
type FeatureCopy = { title: string; desc: string };

function featureCopy(t: (key: string, opts?: { returnObjects: boolean }) => unknown, key: string) {
  const raw = t(key, { returnObjects: true });
  if (!raw || typeof raw !== "object") return { title: "", desc: "" } satisfies FeatureCopy;
  const source = raw as { title?: unknown; desc?: unknown };
  return {
    title: typeof source.title === "string" ? source.title : "",
    desc: typeof source.desc === "string" ? source.desc : "",
  } satisfies FeatureCopy;
}

function Landing() {
  const { t } = useTranslation();
  const features = [
    { icon: Network, ...featureCopy(t, "landing.features.multichannel") },
    { icon: Calendar, ...featureCopy(t, "landing.features.scheduler") },
    { icon: BarChart3, ...featureCopy(t, "landing.features.analytics") },
    { icon: Brain, ...featureCopy(t, "landing.features.brain") },
    { icon: Target, ...featureCopy(t, "landing.features.missions") },
    { icon: Layers, ...featureCopy(t, "landing.features.tenant") },
  ];

  const steps = [
    { icon: Compass, title: "Conecte", desc: "Plugue suas redes, marcas e canais em segundos." },
    {
      icon: Brain,
      title: "Aprende",
      desc: "O Cérebro Cognitivo absorve contexto, métricas e memória.",
    },
    {
      icon: Rocket,
      title: "Executa",
      desc: "Receba missões, conteúdos e decisões prontas para agir.",
    },
  ];

  const proof = [
    t("landing.proof.multichannel", "Multi-canal nativo"),
    t("landing.proof.preflight", "Pré-voo de conteúdo antes de publicar"),
    t("landing.proof.rls", "RLS e auditoria por workspace"),
    t("landing.proof.reality", "Decisões com reality-check"),
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Ambient gradient backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 left-1/2 h-[640px] w-[1100px] -translate-x-1/2 rounded-full bg-gradient-brand opacity-20 blur-[140px]" />
        <div className="absolute top-[40%] -left-40 h-[420px] w-[420px] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute top-[55%] -right-40 h-[420px] w-[420px] rounded-full bg-accent/20 blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_55%,hsl(var(--background))_100%)]" />
      </div>

      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-xl bg-gradient-brand shadow-glow">
            <Brain className="size-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold tracking-tight">VELT</span>
        </div>
        <nav className="flex items-center gap-2 text-sm">
          <div className="hidden sm:block">
            <LanguageSwitcher compact />
          </div>
          <Link
            to="/login"
            className="rounded-md px-3 py-2 text-muted-foreground transition hover:text-foreground"
          >
            {t("common.signIn")}
          </Link>
          <Link
            to="/signup"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground shadow-glow transition hover:opacity-90"
          >
            {t("common.getStarted")}
            <ArrowRight className="size-3.5" />
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        {/* Hero */}
        <section className="py-24 text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur">
            <span className="relative grid size-2 place-items-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-accent/60" />
              <span className="relative size-1.5 rounded-full bg-accent" />
            </span>
            {t("landing.badge")}
          </div>
          <h1 className="text-balance text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
            {t("landing.title1")}{" "}
            <span className="text-gradient-brand">{t("landing.titleHighlight")}</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
            {t("landing.subtitle")}
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-base font-medium text-primary-foreground shadow-glow transition hover:opacity-90"
            >
              {t("landing.startFree")}
              <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/login"
              className="rounded-md border border-border bg-card/60 px-6 py-3 text-base font-medium backdrop-blur transition hover:bg-secondary"
            >
              {t("common.signIn")}
            </Link>
          </div>

          {/* Proof strip */}
          <ul className="mx-auto mt-10 flex max-w-3xl flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            {proof.map((p) => (
              <li key={p} className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-accent" />
                {p}
              </li>
            ))}
          </ul>
        </section>

        {/* How it works */}
        <section className="pb-20">
          <div className="mb-10 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-3 py-1 text-[11px] uppercase tracking-widest text-muted-foreground">
              <Workflow className="size-3.5" /> Como funciona
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
              Do caos digital a um <span className="text-gradient-brand">sistema operacional</span>
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {steps.map((s, i) => (
              <div
                key={s.title}
                className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card/60 p-6 backdrop-blur transition hover:border-primary/40 hover:shadow-elevated"
              >
                <div className="absolute right-4 top-4 text-[11px] font-mono text-muted-foreground/60">
                  0{i + 1}
                </div>
                <div className="grid size-11 place-items-center rounded-xl bg-gradient-brand shadow-glow-sm">
                  <s.icon className="size-5 text-primary-foreground" />
                </div>
                <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.desc}</p>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 transition group-hover:opacity-100" />
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="pb-24">
          <div className="mb-10 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-3 py-1 text-[11px] uppercase tracking-widest text-muted-foreground">
              <Sparkles className="size-3.5 text-accent" /> Plataforma
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
              Tudo o que sua operação digital precisa
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <div
                key={i}
                className="group rounded-2xl border border-border/70 bg-card/60 p-6 backdrop-blur transition hover:border-primary/40 hover:shadow-elevated"
              >
                <div className="inline-flex size-10 items-center justify-center rounded-xl bg-secondary/60 text-accent transition group-hover:bg-gradient-brand group-hover:text-primary-foreground">
                  <f.icon className="size-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="pb-24">
          <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-card/60 p-10 text-center backdrop-blur">
            <div aria-hidden className="absolute inset-0 -z-10 opacity-60">
              <div className="absolute -top-20 left-1/2 h-72 w-[680px] -translate-x-1/2 rounded-full bg-gradient-brand blur-[120px] opacity-40" />
            </div>
            <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-gradient-brand shadow-glow">
              <Shield className="size-6 text-primary-foreground" />
            </div>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Pronto para operar como um <span className="text-gradient-brand">sistema</span>?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Crie seu workspace em 60 segundos. Sem cartão. Migre quando quiser.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-base font-medium text-primary-foreground shadow-glow transition hover:opacity-90"
              >
                {t("landing.startFree")}
                <ArrowRight className="size-4" />
              </Link>
              <Link
                to="/login"
                className="rounded-md border border-border bg-background/40 px-6 py-3 text-base font-medium backdrop-blur transition hover:bg-secondary"
              >
                {t("common.signIn")}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/70 py-8 text-center text-xs text-muted-foreground">
        VELT · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
