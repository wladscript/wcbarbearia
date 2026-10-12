import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { BrandMark } from "@/components/BottomNav";
import { Crown, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ nome: "", telefone: "", senha: "", is_membro: false });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let u;
      if (mode === "login") {
        u = await login(form.telefone.trim(), form.senha);
      } else {
        u = await register({
          nome: form.nome.trim(),
          telefone: form.telefone.trim(),
          senha: form.senha,
          is_membro: form.is_membro,
        });
      }
      toast.success(`Bem-vindo, ${u.nome.split(" ")[0]}!`);
      navigate(u.role === "admin" ? "/admin" : "/app");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "url(https://images.unsplash.com/photo-1621645582931-d1d3e6564943?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/80 to-background" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <BrandMark className="mb-8" />
          <p className="overline mb-2 text-[#D4AF37]">Clube de Membros</p>
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Seu horário,
            <br />
            do seu jeito.
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Agende, acumule pontos de fidelidade e desbloqueie horários VIP de sexta e sábado.
          </p>

          <div className="mt-8 flex rounded-lg border border-border bg-card p-1">
            {["login", "register"].map((m) => (
              <button
                key={m}
                data-testid={`tab-${m}`}
                onClick={() => setMode(m)}
                className={`flex-1 rounded-md py-2 text-sm font-semibold transition-colors duration-200 ${
                  mode === m ? "bg-[#D4AF37] text-[#0D0D0D]" : "text-muted-foreground"
                }`}
              >
                {m === "login" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "register" && (
              <div>
                <Label htmlFor="nome">Nome completo</Label>
                <Input
                  id="nome"
                  data-testid="input-nome"
                  value={form.nome}
                  onChange={(e) => set("nome", e.target.value)}
                  placeholder="Ex: João Silva"
                  required
                  className="mt-1.5 bg-card"
                />
              </div>
            )}
            <div>
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                data-testid="input-telefone"
                value={form.telefone}
                onChange={(e) => set("telefone", e.target.value)}
                placeholder="11999999999"
                required
                className="mt-1.5 bg-card"
              />
            </div>
            <div>
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                data-testid="input-senha"
                type="password"
                value={form.senha}
                onChange={(e) => set("senha", e.target.value)}
                placeholder="••••••••"
                required
                className="mt-1.5 bg-card"
              />
            </div>

            {mode === "register" && (
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#D4AF37]/30 bg-[#D4AF37]/5 p-3">
                <Checkbox
                  data-testid="check-membro"
                  checked={form.is_membro}
                  onCheckedChange={(v) => set("is_membro", !!v)}
                  className="mt-0.5"
                />
                <span className="text-sm">
                  <span className="flex items-center gap-1.5 font-semibold text-[#D4AF37]">
                    <Crown className="h-4 w-4" /> Entrar no Clube de Membros
                  </span>
                  <span className="text-muted-foreground">
                    Acesso prioritário a horários de pico (sex/sáb) e benefícios VIP.
                  </span>
                </span>
              </label>
            )}

            <Button
              type="submit"
              data-testid="submit-auth"
              disabled={loading}
              className="w-full bg-[#D4AF37] py-6 text-base font-semibold text-[#0D0D0D] hover:bg-[#C5A059] active:scale-95"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : mode === "login" ? (
                "Entrar"
              ) : (
                "Criar minha conta"
              )}
            </Button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
