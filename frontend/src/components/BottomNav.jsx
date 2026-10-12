import { NavLink } from "react-router-dom";
import { Home, CalendarPlus, Gift, Scissors } from "lucide-react";

const items = [
  { to: "/app", icon: Home, label: "Início", testid: "nav-home", end: true },
  { to: "/app/agendar", icon: CalendarPlus, label: "Agendar", testid: "nav-book" },
  { to: "/app/fidelidade", icon: Gift, label: "Clube", testid: "nav-loyalty" },
];

export function BottomNav() {
  return (
    <nav
      className="glass fixed bottom-0 left-0 right-0 z-40 mx-auto flex max-w-md items-center justify-around border-t px-2 py-2"
      data-testid="bottom-nav"
    >
      {items.map(({ to, icon: Icon, label, testid, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          data-testid={testid}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-1 rounded-lg py-1.5 transition-colors duration-200 ${
              isActive ? "text-[#D4AF37]" : "text-muted-foreground hover:text-foreground"
            }`
          }
        >
          <Icon className="h-5 w-5" strokeWidth={1.8} />
          <span className="text-[10px] font-medium tracking-wide">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export function BrandMark({ className = "" }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex h-9 w-9 items-center justify-center rounded-lg gold-gradient">
        <Scissors className="h-5 w-5 text-[#0D0D0D]" strokeWidth={2} />
      </div>
      <div className="leading-tight">
        <p className="font-display text-lg font-bold tracking-tight">WC Barbearia</p>
      </div>
    </div>
  );
}
