import { createFileRoute, Link } from "@tanstack/react-router";
import { Brain, Zap, Sparkles, BarChart3, Calendar, Network, Target, Layers } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Digital OS — AI-native operating system for your digital presence" },
      { name: "description", content: "Launch, operate and grow your brand across Instagram, Facebook, YouTube, TikTok and LinkedIn." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { t } = useTranslation();
  const features = [
    { icon: Network, ...t("landing.features.multichannel", { returnObjects: true }) as any },
    { icon: Calendar, ...t("landing.features.scheduler", { returnObjects: true }) as any },
    { icon: BarChart3, ...t("landing.features.analytics", { returnObjects: true }) as any },
    { icon: Brain, ...t("landing.features.brain", { returnObjects: true }) as any },
    { icon: Target, ...t("landing.features.missions", { returnObjects: true }) as any },
    { icon: Layers, ...t("landing.features.tenant", { returnObjects: true }) as any },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-xl bg-gradient-brand shadow-glow">
            <Brain className="size-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Digital OS</span>
        </div>
        <nav className="flex items-center gap-2 text-sm">
          <div className="hidden sm:block"><LanguageSwitcher compact /></div>
          <Link to="/login" className="rounded-md px-3 py-2 text-muted-foreground hover:text-foreground">{t("common.signIn")}</Link>
          <Link to="/signup" className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground shadow-glow hover:opacity-90">{t("common.getStarted")}</Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        <section className="py-24 text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur">
            <Sparkles className="size-3.5 text-accent" />
            {t("landing.badge")}
          </div>
          <h1 className="text-balance text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
            {t("landing.title1")} <span className="text-gradient-brand">{t("landing.titleHighlight")}</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
            {t("landing.subtitle")}
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link to="/signup" className="rounded-md bg-primary px-6 py-3 text-base font-medium text-primary-foreground shadow-glow hover:opacity-90">{t("landing.startFree")}</Link>
            <Link to="/login" className="rounded-md border border-border bg-card/60 px-6 py-3 text-base font-medium backdrop-blur hover:bg-secondary">{t("common.signIn")}</Link>
          </div>
        </section>

        <section className="grid gap-4 pb-24 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card/60 p-6 backdrop-blur transition hover:border-primary/40 hover:shadow-elevated">
              <f.icon className="size-6 text-accent" />
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        Digital OS · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
