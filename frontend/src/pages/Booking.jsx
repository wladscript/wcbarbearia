import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import api, { brl, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, Crown, Loader2, CheckCircle2, Lock, Scissors } from "lucide-react";
import { toast } from "sonner";

const fmtDate = (d) => format(d, "yyyy-MM-dd");

export default function Booking() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [servicos, setServicos] = useState([]);
  const [servico, setServico] = useState(null);
  const [date, setDate] = useState(null);
  const [avail, setAvail] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slot, setSlot] = useState(null);
  const [booking, setBooking] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api.get("/servicos/").then(({ data }) => setServicos(data)).catch(() => {});
  }, []);

  const loadAvail = async (d) => {
    if (!servico) return;
    setLoadingSlots(true);
    setSlot(null);
    try {
      const { data } = await api.get("/agendamentos/disponibilidade", {
        params: { data: fmtDate(d), servico_id: servico.id },
      });
      setAvail(data);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setLoadingSlots(false);
    }
  };

  const pickDate = (d) => {
    if (!d) return;
    setDate(d);
    loadAvail(d);
  };

  const confirm = async () => {
    setBooking(true);
    try {
      await api.post("/agendamentos/", {
        servico_id: servico.id,
        data_hora_inicio: slot.inicio_iso,
      });
      setDone(true);
      toast.success("Agendamento confirmado!");
    } catch (e) {
      const status = e.response?.status;
      if (status === 409) toast.error("Esse horário acabou de ser ocupado. Escolha outro.");
      else toast.error(formatApiErrorDetail(e.response?.data?.detail));
      if (status === 409 && date) loadAvail(date);
    } finally {
      setBooking(false);
    }
  };

  const goBack = () => {
    if (done) return navigate("/app");
    if (step === 1) return navigate("/app");
    setStep(step - 1);
  };

  if (done) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <CheckCircle2 className="h-20 w-20 text-emerald-400" strokeWidth={1.4} />
        </motion.div>
        <h1 className="mt-6 font-display text-3xl font-bold">Horário reservado!</h1>
        <p className="mt-2 text-muted-foreground">
          {servico.nome} • {format(date, "dd 'de' MMMM", { locale: ptBR })} às {slot.hora}
        </p>
        <p className="mt-1 text-sm text-amber-400">Aguardando confirmação do barbeiro.</p>
        <Button
          data-testid="go-home-btn"
          onClick={() => navigate("/app")}
          className="mt-8 w-full bg-[#D4AF37] py-6 text-[#0D0D0D] hover:bg-[#C5A059]"
        >
          Voltar ao início
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-5 pb-28 pt-6">
      <header className="flex items-center gap-3">
        <button data-testid="back-btn" onClick={goBack} className="rounded-lg p-2 hover:bg-card">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <p className="overline text-[#D4AF37]">Passo {step} de 3</p>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {step === 1 ? "Escolha o serviço" : step === 2 ? "Data & horário" : "Confirmação"}
          </h1>
        </div>
      </header>

      {/* stepper */}
      <div className="mt-4 flex gap-1.5">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              s <= step ? "bg-[#D4AF37]" : "bg-border"
            }`}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* STEP 1 — Services */}
        {step === 1 && (
          <motion.div
            key="s1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="mt-6 space-y-3"
            data-testid="servicos-list"
          >
            {servicos.map((s) => (
              <button
                key={s.id}
                data-testid={`servico-${s.id}`}
                onClick={() => {
                  setServico(s);
                  setStep(2);
                }}
                className="flex w-full items-center gap-4 overflow-hidden rounded-xl border border-white/10 bg-card p-3 text-left transition-transform duration-200 hover:-translate-y-1 active:scale-95"
              >
                <div
                  className="h-16 w-16 flex-shrink-0 rounded-lg bg-secondary bg-cover bg-center"
                  style={{ backgroundImage: s.imagem_url ? `url(${s.imagem_url})` : undefined }}
                >
                  {!s.imagem_url && <Scissors className="m-auto mt-5 h-6 w-6 text-[#D4AF37]" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-semibold">{s.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">{s.descricao}</p>
                  <div className="mt-1 flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3 w-3" /> {s.duracao_minutos} min
                    </span>
                    <span className="font-semibold text-[#D4AF37]">{brl(s.preco_base)}</span>
                  </div>
                </div>
              </button>
            ))}
          </motion.div>
        )}

        {/* STEP 2 — Date & Time */}
        {step === 2 && (
          <motion.div
            key="s2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="mt-6"
          >
            <div className="flex justify-center rounded-xl border border-white/10 bg-card p-2">
              <Calendar
                mode="single"
                selected={date}
                onSelect={pickDate}
                locale={ptBR}
                disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0)) || d.getDay() === 0}
                data-testid="calendar"
              />
            </div>

            {!user?.is_membro && date && (date.getDay() === 5 || date.getDay() === 6) && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-3 text-sm">
                <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#D4AF37]" />
                <span className="text-muted-foreground">
                  Sextas e sábados são <span className="text-[#D4AF37]">exclusivos para membros</span>.
                  Torne-se membro para desbloquear horários de pico.
                </span>
              </div>
            )}

            {date && (
              <div className="mt-5">
                <p className="mb-3 text-sm font-semibold">Horários disponíveis</p>
                {loadingSlots ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-[#D4AF37]" />
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2" data-testid="slots-grid">
                    {avail?.slots?.map((sl) => {
                      const selected = slot?.hora === sl.hora;
                      return (
                        <button
                          key={sl.hora}
                          data-testid={`slot-${sl.hora}`}
                          disabled={!sl.disponivel}
                          onClick={() => setSlot(sl)}
                          className={`rounded-lg border py-2.5 text-sm font-medium transition-all duration-200 ${
                            selected
                              ? "border-[#D4AF37] bg-[#D4AF37] text-[#0D0D0D] shadow-[0_0_14px_rgba(212,175,55,0.4)]"
                              : sl.disponivel
                                ? "border-white/10 bg-card hover:border-[#D4AF37]/50"
                                : "cursor-not-allowed border-transparent bg-secondary/40 text-muted-foreground/40 line-through"
                          }`}
                        >
                          {sl.hora}
                        </button>
                      );
                    })}
                    {avail && avail.slots.length === 0 && (
                      <p className="col-span-4 py-6 text-center text-sm text-muted-foreground">
                        Fechado neste dia.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <Button
              data-testid="to-confirm-btn"
              disabled={!slot}
              onClick={() => setStep(3)}
              className="mt-6 w-full bg-[#D4AF37] py-6 text-[#0D0D0D] hover:bg-[#C5A059] disabled:opacity-40"
            >
              Continuar
            </Button>
          </motion.div>
        )}

        {/* STEP 3 — Confirm */}
        {step === 3 && (
          <motion.div
            key="s3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="mt-6"
          >
            <div className="rounded-xl border border-white/10 bg-card p-6" data-testid="confirm-summary">
              <p className="overline text-[#D4AF37]">Resumo</p>
              <h2 className="mt-2 font-display text-2xl font-bold">{servico.nome}</h2>
              <div className="mt-5 space-y-3 text-sm">
                <Row label="Data" value={format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })} />
                <Row label="Horário" value={`${slot.hora} (${servico.duracao_minutos} min)`} />
                <Row
                  label="Cliente"
                  value={
                    <span className="flex items-center gap-1">
                      {user?.nome}
                      {user?.is_membro && <Crown className="h-3.5 w-3.5 text-[#D4AF37]" />}
                    </span>
                  }
                />
                <div className="my-3 border-t border-border" />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-display text-2xl font-bold text-[#D4AF37]">
                    {brl(servico.preco_base)}
                  </span>
                </div>
              </div>
            </div>

            <Button
              data-testid="confirm-booking-btn"
              onClick={confirm}
              disabled={booking}
              className="mt-6 w-full bg-[#D4AF37] py-6 text-base font-semibold text-[#0D0D0D] hover:bg-[#C5A059]"
            >
              {booking ? <Loader2 className="h-5 w-5 animate-spin" /> : "Confirmar agendamento"}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const Row = ({ label, value }) => (
  <div className="flex items-center justify-between">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium">{value}</span>
  </div>
);
