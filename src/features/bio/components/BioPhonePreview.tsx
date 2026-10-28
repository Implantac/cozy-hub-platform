import { Mail, MessageCircle, Phone, ShoppingBag, Link2 } from "lucide-react";
import type { BioLinkRow } from "../hooks/useBioPage";
import { themeFor } from "@/lib/bio/theme";

const ICONS = {
  whatsapp: MessageCircle,
  email: Mail,
  phone: Phone,
  product: ShoppingBag,
  link: Link2,
} as const;

/**
 * Live phone preview.
 *
 * Not a screenshot and not an iframe: it renders the same tokens and the same
 * component tree shape as the public page, at a fixed 320px content width. It
 * deliberately does NOT fetch the public route — an unpublished draft has no
 * public route to fetch, and the owner should see what *will* be published.
 */
export function BioPhonePreview({
  headline,
  bio,
  avatarUrl,
  theme,
  links,
}: {
  headline: string;
  bio: string;
  avatarUrl: string;
  theme: string;
  links: BioLinkRow[];
}) {
  const t = themeFor(theme);
  const visible = links.filter((l) => l.is_active);

  return (
    <div className="mx-auto w-full max-w-[360px]">
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-xs font-medium text-muted-foreground">Prévia</p>
        <p className="text-xs text-muted-foreground">390 × auto</p>
      </div>

      {/* Device frame */}
      <div className="rounded-[2rem] border-4 border-foreground/10 bg-foreground/5 p-1.5 shadow-sm">
        <div
          className="overflow-hidden rounded-[1.6rem]"
          style={{ background: t.bg, color: t.text }}
        >
          <div className="px-5 pb-8 pt-7" style={{ fontFamily: "ui-sans-serif, system-ui" }}>
            {/* Identity */}
            <div className="text-center">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  className="mx-auto mb-3 h-16 w-16 rounded-full object-cover"
                  style={{ border: `2px solid ${t.accent}55` }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div
                  aria-hidden
                  className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full text-2xl font-bold"
                  style={{ background: `${t.accent}30`, border: `2px solid ${t.accent}55` }}
                >
                  {headline.trim().charAt(0).toUpperCase() || "V"}
                </div>
              )}

              <p className="text-base font-bold leading-tight" style={{ letterSpacing: "-0.01em" }}>
                {headline || "Seu título aqui"}
              </p>

              {bio && (
                <p className="mt-1.5 whitespace-pre-line text-[11px] leading-relaxed opacity-75">
                  {bio}
                </p>
              )}
            </div>

            {/* Links */}
            <div className="mt-5 space-y-2">
              {visible.map((link) => {
                const Icon = ICONS[(link.kind as keyof typeof ICONS) ?? "link"] ?? Link2;
                return (
                  <div
                    key={link.id}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[12px] font-semibold"
                    style={{
                      background: t.card,
                      border: "1px solid rgba(255,255,255,0.12)",
                    }}
                  >
                    <Icon size={14} style={{ opacity: 0.85 }} aria-hidden />
                    <span className="flex-1 truncate text-center">{link.label}</span>
                    <span className="w-[14px]" aria-hidden />
                  </div>
                );
              })}

              {visible.length === 0 && (
                <p className="py-3 text-center text-[11px] opacity-50">Seus links aparecem aqui</p>
              )}
            </div>

            <p className="mt-6 text-center text-[9px] uppercase tracking-wider opacity-40">
              feito com VELT
            </p>
          </div>
        </div>
      </div>

      <p className="mt-2 px-1 text-[11px] leading-snug text-muted-foreground">
        A maioria dos acessos abre isto na bio do Instagram — por isso a prévia é sempre estreita.
      </p>
    </div>
  );
}
