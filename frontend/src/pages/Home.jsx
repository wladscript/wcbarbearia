import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { format, parseISO, isFuture } from "date-fns";
import { ptBR } from "date-fns/locale";
import api, { brl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BrandMark } from "@/components/BottomNav";
import { Crown, LogOut, Gift, CalendarPlus, Clock, Sparkles, ChevronRight } from "lucide-react";

const STATUS_STYLES = {
  Pendente: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  Confirmado: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  Concluido: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  Cancelado: "bg-red-500/15 text-red-400 border-red-500/30",
};

export default function Home() {
  const { user, logout, refreshMe } = useAuth();
  const navigate = useNavigate();
  const [agendamentos, setAgendamentos] = useState([]);

  useEffect(() => {
    refreshMe().catch(() => {});
    api.get("/agendamentos/").then(({ data }) => setAgendamentos(data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upcoming = agendamentos
    .filter((a) => a.status !== "Cancelado" && isFuture(parseISO(a.data_hora_inicio)))
    .sort((a, b) => a.data_hora_inicio.localeCompare(b.data_hora_inicio));
  const next = upcoming[0];
  const pontos = user?.pontos_fidelidade || 0;
  const progress = Math.min(100, (pontos / 100) * 100);

  return (
    <div className="mx-auto max-w-md px-5 pb-28 pt-6">
      <header className="flex items-center justify-between">
        <BrandMark />
        <Button
          variant="ghost"
          size="icon"
          data-testid="logout-btn"
          onClick={logout}
          className="text-muted-foreground"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </header>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
        <p className="text-sm text-muted-foreground">Olá,</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {user?.nome?.split(" ")[0]}
          {user?.is_membro && (
            <Crown className="mb-1 ml-2 inline h-6 w-6 text-[#D4AF37]" />
          )}
        </h1>
      </motion.div>

      {/* Bento grid */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        {/* Loyalty — big span */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          data-testid="loyalty-card"
          className="col-span-2 overflow-hidden rounded-xl border border-[#D4AF37]/30 bg-grain p-5"
          style={{ background: "linear-gradient(135deg, rgba(212,175,55,0.14), rgba(140,90,53,0.08))" }}
        >
          <div className="flex items-center justify-between">
            <p className="overline text-[#D4AF37]">Pontos de Fidelidade</p>
            <Sparkles className="h-5 w-5 text-[#D4AF37]" />
          </div>
          <p className="mt-2 font-display text-5xl font-bold tracking-tight" data-testid="pontos-valor">
            {pontos}
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/40">
            <div className="h-full gold-gradient transition-all duration-700" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {pontos >= 100
              ? "Você pode resgatar um voucher de R$20!"
              : `Faltam ${100 - pontos} pontos para um voucher de R$20`}
          </p>
        </motion.div>

        {/* Agendar */}
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          data-testid="quick-book"
          onClick={() => navigate("/app/agendar")}
          className="flex flex-col items-start gap-3 rounded-xl border border-white/10 bg-card p-5 text-left transition-transform duration-200 hover:-translate-y-1 active:scale-95"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#D4AF37] text-[#0D0D0D]">
            <CalendarPlus className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold">Agendar</p>
            <p className="text-xs text-muted-foreground">Novo horário</p>
          </div>
        </motion.button>

        {/* Clube */}
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          data-testid="quick-loyalty"
          onClick={() => navigate("/app/fidelidade")}
          className="flex flex-col items-start gap-3 rounded-xl border border-white/10 bg-card p-5 text-left transition-transform duration-200 hover:-translate-y-1 active:scale-95"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-[#D4AF37]">
            <Gift className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold">Clube</p>
            <p className="text-xs text-muted-foreground">Resgatar pontos</p>
          </div>
        </motion.button>
      </div>

      {/* Next appointment */}
      <h2 className="mt-8 text-lg font-semibold">Próximo horário</h2>
      {next ? (
        <div
          data-testid="next-appointment"
          className="mt-3 rounded-xl border border-white/10 bg-card p-5"
        >
          <div className="flex items-center justify-between">
            <p className="font-display text-xl font-semibold">{next.servico_nome}</p>
            <Badge className={`border ${STATUS_STYLES[next.status]}`}>{next.status}</Badge>
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            {format(parseISO(next.data_hora_inicio), "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
          </div>
          <p className="mt-1 text-sm font-medium text-[#D4AF37]">{brl(next.valor_final)}</p>
        </div>
      ) : (
        <button
          data-testid="empty-book-cta"
          onClick={() => navigate("/app/agendar")}
          className="mt-3 flex w-full items-center justify-between rounded-xl border border-dashed border-white/15 bg-card/50 p-5 text-left transition-colors hover:border-[#D4AF37]/40"
        >
          <span className="text-sm text-muted-foreground">Nenhum horário marcado. Que tal agendar?</span>
          <ChevronRight className="h-5 w-5 text-[#D4AF37]" />
        </button>
      )}

      {/* History */}
      {agendamentos.length > 0 && (
        <>
          <h2 className="mt-8 text-lg font-semibold">Meus agendamentos</h2>
          <div className="mt-3 space-y-2" data-testid="agendamentos-list">
            {agendamentos.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-lg border border-white/5 bg-card/60 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{a.servico_nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(parseISO(a.data_hora_inicio), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <Badge className={`border text-[11px] ${STATUS_STYLES[a.status]}`}>{a.status}</Badge>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
