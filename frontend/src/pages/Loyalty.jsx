import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import api, { brl, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/BottomNav";
import { Crown, Gift, Sparkles, Ticket, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

export default function Loyalty() {
  const { user, refreshMe } = useAuth();
  const [vouchers, setVouchers] = useState([]);
  const [redeeming, setRedeeming] = useState(false);

  const load = () => {
    api.get("/vouchers/").then(({ data }) => setVouchers(data)).catch(() => {});
    refreshMe().catch(() => {});
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pontos = user?.pontos_fidelidade || 0;
  const canRedeem = pontos >= 100;

  const redeem = async () => {
    setRedeeming(true);
    try {
      const { data } = await api.post("/fidelidade/resgatar/");
      toast.success(`Voucher ${data.codigo} gerado! -100 pontos.`);
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-5 pb-28 pt-6">
      <header className="flex items-center justify-between">
        <BrandMark />
      </header>

      {/* Membership status */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-6 overflow-hidden rounded-2xl border border-[#D4AF37]/40 bg-grain p-6"
        style={{ background: "linear-gradient(135deg, rgba(212,175,55,0.18), rgba(140,90,53,0.1))" }}
        data-testid="membership-card"
      >
        <div className="flex items-center justify-between">
          <p className="overline text-[#D4AF37]">{user?.is_membro ? "Membro VIP" : "Cliente"}</p>
          <Crown className={`h-6 w-6 ${user?.is_membro ? "text-[#D4AF37]" : "text-muted-foreground"}`} />
        </div>
        <p className="mt-6 text-sm text-muted-foreground">Saldo de pontos</p>
        <p className="font-display text-6xl font-bold tracking-tight">{pontos}</p>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-black/40">
          <div
            className="h-full gold-gradient transition-all duration-700"
            style={{ width: `${Math.min(100, pontos)}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {canRedeem ? "Pronto para resgatar!" : `${100 - pontos} pontos para o próximo voucher`}
        </p>
      </motion.div>

      {/* Redeem */}
      <div className="mt-5 rounded-xl border border-white/10 bg-card p-5" data-testid="redeem-box">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#D4AF37]/15">
            <Gift className="h-5 w-5 text-[#D4AF37]" />
          </div>
          <div>
            <p className="font-semibold">Resgatar voucher</p>
            <p className="text-xs text-muted-foreground">100 pontos = R$20 de desconto</p>
          </div>
        </div>
        <Button
          data-testid="redeem-btn"
          onClick={redeem}
          disabled={!canRedeem || redeeming}
          className="mt-4 w-full bg-[#D4AF37] py-5 text-[#0D0D0D] hover:bg-[#C5A059] disabled:opacity-40"
        >
          {redeeming ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : canRedeem ? (
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Resgatar agora
            </span>
          ) : (
            "Pontos insuficientes"
          )}
        </Button>
      </div>

      {/* How it works */}
      <div className="mt-5 rounded-xl border border-white/5 bg-card/50 p-5 text-sm text-muted-foreground">
        <p className="mb-2 font-semibold text-foreground">Como funciona</p>
        <ul className="space-y-1.5">
          <li>• Ganhe <span className="text-[#D4AF37]">10 pontos</span> a cada serviço concluído.</li>
          <li>• Junte <span className="text-[#D4AF37]">100 pontos</span> e troque por R$20.</li>
          <li>• Membros têm acesso a horários de pico (sex/sáb).</li>
        </ul>
      </div>

      {/* Vouchers list */}
      <h2 className="mt-8 text-lg font-semibold">Meus vouchers</h2>
      {vouchers.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nenhum voucher resgatado ainda.</p>
      ) : (
        <div className="mt-3 space-y-2" data-testid="vouchers-list">
          {vouchers.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between rounded-lg border border-dashed border-[#D4AF37]/40 bg-[#D4AF37]/5 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <Ticket className="h-5 w-5 text-[#D4AF37]" />
                <div>
                  <p className="font-mono text-sm font-semibold tracking-wider">{v.codigo}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(parseISO(v.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-display text-lg font-bold text-[#D4AF37]">{brl(v.valor_desconto)}</p>
                {v.is_resgatado && (
                  <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                    <Check className="h-3 w-3" /> usado
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
