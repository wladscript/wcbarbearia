import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import api, { brl, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Scissors, LogOut, CalendarClock, CheckCircle2, DollarSign, Crown, Users } from "lucide-react";
import { toast } from "sonner";

const STATUSES = ["Pendente", "Confirmado", "Concluido", "Cancelado"];
const STATUS_STYLES = {
  Pendente: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  Confirmado: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  Concluido: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  Cancelado: "bg-red-500/15 text-red-400 border-red-500/30",
};

export default function Admin() {
  const { user, logout } = useAuth();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("Todos");

  const load = () => api.get("/agendamentos/").then(({ data }) => setItems(data)).catch(() => {});

  useEffect(() => {
    load();
  }, []);

  const changeStatus = async (id, status) => {
    try {
      await api.patch(`/agendamentos/${id}/status`, { status });
      toast.success(`Status atualizado para ${status}`);
      if (status === "Concluido") toast.info("+10 pontos de fidelidade creditados ao cliente.");
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const stats = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    return {
      hoje: items.filter((a) => a.data_hora_inicio.startsWith(today) && a.status !== "Cancelado").length,
      pendentes: items.filter((a) => a.status === "Pendente").length,
      concluidos: items.filter((a) => a.status === "Concluido").length,
      receita: items.filter((a) => a.status === "Concluido").reduce((s, a) => s + (a.valor_final || 0), 0),
    };
  }, [items]);

  const filtered = filter === "Todos" ? items : items.filter((a) => a.status === filter);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass sticky top-0 z-30 border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg gold-gradient">
              <Scissors className="h-5 w-5 text-[#0D0D0D]" />
            </div>
            <div>
              <p className="font-display text-lg font-bold tracking-tight">WC Barbearia</p>
              <p className="text-xs text-muted-foreground">Painel do Barbeiro</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user?.nome}</span>
            <Button variant="ghost" size="icon" data-testid="admin-logout" onClick={logout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Summary widgets */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" data-testid="admin-stats">
          <StatCard icon={CalendarClock} label="Hoje" value={stats.hoje} tone="text-[#D4AF37]" />
          <StatCard icon={Users} label="Pendentes" value={stats.pendentes} tone="text-amber-400" />
          <StatCard icon={CheckCircle2} label="Concluídos" value={stats.concluidos} tone="text-emerald-400" />
          <StatCard icon={DollarSign} label="Receita" value={brl(stats.receita)} tone="text-[#D4AF37]" />
        </div>

        {/* Filters */}
        <div className="mt-8 flex flex-wrap items-center gap-2">
          {["Todos", ...STATUSES].map((s) => (
            <button
              key={s}
              data-testid={`filter-${s}`}
              onClick={() => setFilter(s)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors duration-200 ${
                filter === s
                  ? "border-[#D4AF37] bg-[#D4AF37] text-[#0D0D0D]"
                  : "border-border text-muted-foreground hover:border-[#D4AF37]/40"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="mt-5 overflow-hidden rounded-xl border border-border bg-card">
          <Table data-testid="admin-table">
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Cliente</TableHead>
                <TableHead>Serviço</TableHead>
                <TableHead>Data / Hora</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                    Nenhum agendamento.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((a) => (
                  <TableRow key={a.id} className="border-border" data-testid={`row-${a.id}`}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-1.5">
                        {a.usuario_nome}
                        {a.usuario_membro && <Crown className="h-3.5 w-3.5 text-[#D4AF37]" />}
                      </span>
                      <span className="text-xs text-muted-foreground">{a.usuario_telefone}</span>
                    </TableCell>
                    <TableCell>{a.servico_nome}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {format(parseISO(a.data_hora_inicio), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-[#D4AF37]">{brl(a.valor_final)}</TableCell>
                    <TableCell>
                      <Badge className={`border ${STATUS_STYLES[a.status]}`}>{a.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Select value={a.status} onValueChange={(v) => changeStatus(a.id, v)}>
                        <SelectTrigger
                          className="ml-auto w-[140px] bg-secondary"
                          data-testid={`status-select-${a.id}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => (
                            <SelectItem key={s} value={s} data-testid={`status-opt-${s}`}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
}

const StatCard = ({ icon: Icon, label, value, tone }) => (
  <div className="rounded-xl border border-border bg-card p-5">
    <div className="flex items-center justify-between">
      <p className="overline text-muted-foreground">{label}</p>
      <Icon className={`h-5 w-5 ${tone}`} />
    </div>
    <p className={`mt-3 font-display text-3xl font-bold ${tone}`}>{value}</p>
  </div>
);
