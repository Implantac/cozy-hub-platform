import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  BarChart3, BrainCircuit, FlaskConical, History, Scale, ShieldAlert, User, Users2,
} from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { PageTransition } from "@/components/app/Motion";
import { AntiScamPanel } from "@/features/brain-lab/panels/AntiScamPanel";
import { CouncilPanel } from "@/features/brain-lab/panels/CouncilPanel";
import { DecisionsPanel } from "@/features/brain-lab/panels/DecisionsPanel";
import { ExperimentsPanel } from "@/features/brain-lab/panels/ExperimentsPanel";
import { SkillsPanel } from "@/features/brain-lab/panels/SkillsPanel";
import { TimelinePanel } from "@/features/brain-lab/panels/TimelinePanel";
import { TwinPanel } from "@/features/brain-lab/panels/TwinPanel";
import type { BrainLabTab } from "@/features/brain-lab/constants";

export const Route = createFileRoute("/_authenticated/app/brain-lab")({
  component: BrainLabPage,
});

const TABS = [
  ["twin", "Digital Twin", User],
  ["skills", "Mapa de Skills", BarChart3],
  ["experiments", "Experimentos", FlaskConical],
  ["decisions", "Decisões", Scale],
  ["anti_scam", "Anti-Golpe", ShieldAlert],
  ["council", "Conselho IA", Users2],
  ["timeline", "Mentor LP", History],
] as const;

function BrainLabPage() {
  const [tab, setTab] = useState<BrainLabTab>("twin");

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          icon={BrainCircuit}
          title="Brain Lab"
          subtitle="O cérebro por trás dos módulos: Digital Twin, habilidades, experimentos, decisões, anti-golpe, conselho IA."
        />

        <nav className="flex flex-wrap gap-2 border-b border-border pb-2">
          {TABS.map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition ${
                tab === key
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </nav>

        {tab === "twin" && <TwinPanel />}
        {tab === "skills" && <SkillsPanel />}
        {tab === "experiments" && <ExperimentsPanel />}
        {tab === "decisions" && <DecisionsPanel />}
        {tab === "anti_scam" && <AntiScamPanel />}
        {tab === "council" && <CouncilPanel />}
        {tab === "timeline" && <TimelinePanel />}
      </div>
    </PageTransition>
  );
}
