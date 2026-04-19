import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { MessageSquare, Wallet, Package, ShoppingCart, LogOut, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppLayout() {
  const { user, loading, signOut } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && !user) nav("/auth");
  }, [user, loading, nav]);

  if (loading || !user) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  }

  const navItems = [
    { to: "/app", icon: MessageSquare, label: "Chat", end: true },
    { to: "/app/cart", icon: ShoppingCart, label: "Cart" },
    { to: "/app/wallet", icon: Wallet, label: "Wallet" },
    { to: "/app/orders", icon: Package, label: "Orders" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-lg">
        <div className="flex items-center justify-between px-4 py-3 max-w-5xl mx-auto w-full">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg gradient-primary grid place-items-center text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="font-display font-bold text-lg">Atlas</span>
          </div>
          <div className="hidden lg:flex items-center gap-1">
            {navItems.map(({ to, icon: Icon, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                    isActive ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-secondary"
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={() => signOut().then(() => nav("/auth"))}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full pb-24 lg:pb-8">
        <Outlet />
      </main>

      {/* Bottom nav (mobile-first) */}
      <nav className="fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur-lg lg:hidden">
        <div className="grid grid-cols-4 max-w-5xl mx-auto">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
