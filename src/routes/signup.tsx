import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Brain } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Create account · VELT" }] }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_e, session) => {
      if (session?.user) navigate({ to: "/app", replace: true });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        data: { full_name: name },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(t("auth.accountCreated"));
  }

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) toast.error(t("auth.googleFailed"));
  }

  return (
    <div className="relative grid min-h-screen place-items-center px-4 py-12 overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_100%,oklch(0.72_0.2_285_/_0.15),transparent_50%)]" />

      <div className="w-full max-w-md card-premium p-8 sm:p-10 animate-rise-in">
        <div className="mb-8 flex items-center justify-between">
          <Link to="/" className="group flex items-center gap-2.5">
            <div className="grid size-10 place-items-center rounded-xl bg-gradient-brand shadow-glow transition-transform group-hover:scale-110">
              <Brain className="size-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight text-foreground">VELT</span>
          </Link>
          <LanguageSwitcher compact />
        </div>

        <div className="space-y-1 mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t("auth.signupTitle")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("auth.signupSubtitle")}</p>
        </div>

        <button
          onClick={handleGoogle}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-card/40 px-4 py-3 text-sm font-semibold transition-all hover:bg-card hover:border-primary/30 hover:shadow-soft active:scale-[0.98]"
        >
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
            <path
              fill="#EA4335"
              d="M12 11v3.2h5.5c-.2 1.5-1.7 4.3-5.5 4.3-3.3 0-6-2.7-6-6.1S8.7 6.4 12 6.4c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.9 14.6 3 12 3 6.9 3 2.8 7.1 2.8 12S6.9 21 12 21c6.9 0 9.2-4.8 9.2-7.3 0-.5-.1-.9-.1-1.3H12z"
            />
          </svg>
          <span>{t("common.continueWithGoogle")}</span>
        </button>

        <div className="my-7 flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
          <div className="h-px flex-1 bg-border/50" />
          {t("common.or")}
          <div className="h-px flex-1 bg-border/50" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 ml-1">
              {t("common.name")}
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Seu nome"
              className="w-full rounded-xl border border-border bg-background/50 px-4 py-2.5 text-sm transition-all focus:border-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/10 placeholder:text-muted-foreground/40"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 ml-1">
              {t("common.email")}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full rounded-xl border border-border bg-background/50 px-4 py-2.5 text-sm transition-all focus:border-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/10 placeholder:text-muted-foreground/40"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 ml-1">
              {t("common.password")}
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="No mínimo 8 caracteres"
              className="w-full rounded-xl border border-border bg-background/50 px-4 py-2.5 text-sm transition-all focus:border-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/10 placeholder:text-muted-foreground/40"
            />
          </div>
          <button
            disabled={loading}
            className="w-full mt-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground shadow-glow transition-all hover:opacity-95 hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 disabled:translate-y-0"
          >
            {loading ? t("auth.creating") : t("common.createAccount")}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          {t("auth.alreadyOnboard")}{" "}
          <Link
            to="/login"
            className="font-semibold text-primary hover:underline underline-offset-4"
          >
            {t("common.signIn")}
          </Link>
        </p>
      </div>
    </div>
  );
}
