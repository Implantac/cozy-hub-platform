import { motion } from "framer-motion";
import { Calendar, FileText, Palette, Radio } from "lucide-react";
import { stagger } from "@/components/app/motion-presets";
import { KpiCard } from "../components/atoms";

type Props = {
  brands: number;
  channelsConnected: number;
  channels: number;
  content: number;
  scheduled: number;
};

export function KpiFooterSection({
  brands,
  channelsConnected,
  channels,
  content,
  scheduled,
}: Props) {
  return (
    <motion.section variants={stagger} className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <KpiCard icon={Palette} label="Marcas" value={brands} to="/app/brands" />
      <KpiCard
        icon={Radio}
        label="Canais"
        value={`${channelsConnected}/${channels}`}
        to="/app/channels"
      />
      <KpiCard icon={FileText} label="Conteúdos" value={content} to="/app/content" />
      <KpiCard icon={Calendar} label="Agendados" value={scheduled} to="/app/scheduler" />
    </motion.section>
  );
}
