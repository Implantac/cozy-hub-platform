import { createFileRoute, Link } from "@tanstack/react-router";
import { Brain, Zap, Sparkles, BarChart3, Calendar, Network } from "lucide-react";

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
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-xl bg-gradient-brand shadow-glow">
            <Brain className="size-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Digital OS</span>
        </div>
        <nav className="flex items-center gap-3 text-sm">
          <Link to="/login" className="rounded-md px-3 py-2 text-muted-foreground hover:text-foreground">Sign in</Link>
          <Link to="/signup" className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground shadow-glow hover:opacity-90">Get started</Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        <section className="py-24 text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur">
            <Sparkles className="size-3.5 text-accent" />
            Native Cognitive Brain · pgvector · multi-tenant
          </div>
          <h1 className="text-balance text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
            The operating system for your <span className="text-gradient-brand">digital presence</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
            Connect every channel, schedule every post, monitor every signal — and let a Native Cognitive Brain turn it into recommendations and missions.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link to="/signup" className="rounded-md bg-primary px-6 py-3 text-base font-medium text-primary-foreground shadow-glow hover:opacity-90">Start free</Link>
            <Link to="/login" className="rounded-md border border-border bg-card/60 px-6 py-3 text-base font-medium backdrop-blur hover:bg-secondary">Sign in</Link>
          </div>
        </section>

        <section className="grid gap-4 pb-24 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Network, title: "Multi-channel", desc: "Instagram, Facebook, YouTube, TikTok, LinkedIn — unified." },
            { icon: Calendar, title: "Scheduler with retry", desc: "Queue with DLQ and per-channel publishing." },
            { icon: BarChart3, title: "Analytics", desc: "Aggregated metrics, trends, channel comparisons." },
            { icon: Brain, title: "Native Brain", desc: "Rule engine + memory + recommendations." },
            { icon: Zap, title: "Event-driven", desc: "First-class events: ContentCreated, OAuthConnected." },
            { icon: Sparkles, title: "AI-native", desc: "Provider abstraction: Lovable AI, Ollama, Qwen, Llama." },
          ].map((f, i) => (
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
