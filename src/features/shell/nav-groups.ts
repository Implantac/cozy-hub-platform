import {
  Activity,
  BarChart3,
  Brain,
  Brain as BrainIcon,
  Calendar,
  Compass,
  FileText,
  FlaskConical,
  GitBranch,
  GraduationCap,
  LayoutDashboard,
  Lightbulb,
  Link2,
  Palette,
  RadarIcon,
  Radio,
  Rocket,
  Shield,
  ShoppingBag,
  Target,
  TrendingUp,
  Wand2,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { to: string; labelKey: string; icon: LucideIcon; exact?: boolean };
export type NavGroup = { labelKey: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: "nav.group.gps",
    items: [
      { to: "/app", labelKey: "nav.dashboard", icon: LayoutDashboard, exact: true },
      { to: "/app/score", labelKey: "nav.score", icon: TrendingUp },
      { to: "/app/health", labelKey: "nav.health", icon: Activity },
    ],
  },
  {
    labelKey: "nav.group.decision",
    items: [
      { to: "/app/navigator", labelKey: "nav.navigator", icon: Compass },
      { to: "/app/journey", labelKey: "nav.journey", icon: GitBranch },
      { to: "/app/builder", labelKey: "nav.builder", icon: Rocket },
      { to: "/app/opportunities", labelKey: "nav.opportunities", icon: RadarIcon },
      { to: "/app/competitors", labelKey: "nav.competitors", icon: RadarIcon },
      { to: "/app/decisions", labelKey: "nav.decisions", icon: Lightbulb },
    ],
  },
  {
    labelKey: "nav.group.trust",
    items: [{ to: "/app/trust", labelKey: "nav.trust", icon: Shield }],
  },
  {
    labelKey: "nav.group.execution",
    items: [
      { to: "/app/brands", labelKey: "nav.brands", icon: Palette },
      { to: "/app/channels", labelKey: "nav.channels", icon: Radio },
      { to: "/app/content", labelKey: "nav.content", icon: FileText },
      { to: "/app/scheduler", labelKey: "nav.scheduler", icon: Calendar },
      { to: "/app/bio", labelKey: "nav.bio", icon: Link2 },
    ],
  },
  {
    labelKey: "nav.group.growth",
    items: [
      { to: "/app/coach", labelKey: "nav.coach", icon: Wand2 },
      { to: "/app/missions", labelKey: "nav.missions", icon: Target },
      { to: "/app/skill-map", labelKey: "nav.skill_map", icon: BrainIcon },
      { to: "/app/learning", labelKey: "nav.learning", icon: GraduationCap },
      { to: "/app/analytics", labelKey: "nav.analytics", icon: BarChart3 },
    ],
  },
  {
    labelKey: "nav.group.brain",
    items: [
      { to: "/app/brain", labelKey: "nav.brain", icon: Brain, exact: true },
      { to: "/app/brain-lab", labelKey: "nav.brain_lab", icon: FlaskConical },
    ],
  },
  {
    labelKey: "nav.group.commerce",
    items: [{ to: "/app/commerce", labelKey: "nav.commerce", icon: ShoppingBag }],
  },
];

/** Boundary-aware active check: `/app/brain` does not match `/app/brain-lab`. */
export function isItemActive(path: string, item: NavItem): boolean {
  if (item.exact) return path === item.to;
  return path === item.to || path.startsWith(item.to + "/");
}

export function findBreadcrumb(path: string, t: (k: string) => string) {
  for (const g of NAV_GROUPS) {
    for (const it of g.items) {
      if (isItemActive(path, it)) return { group: t(g.labelKey), page: t(it.labelKey) };
    }
  }
  if (path.includes("/settings"))
    return { group: t("nav.group.settings"), page: t("nav.settings") };
  return { group: t("nav.group.overview"), page: t("nav.dashboard") };
}

export type Workspace = { id: string; name: string; plan: string; role: string };

export const SIDEBAR_COLLAPSE_KEY = "digitalos.sidebar_collapsed";
