import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ShoppingBag,
  Video,
  CalendarClock,
  Library,
  Settings,
  ShoppingBag as Logo,
  LogOut,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/products", label: "Produtos", icon: ShoppingBag },
  { to: "/videos", label: "Vídeos", icon: Video },
  { to: "/schedule", label: "Agendamento", icon: CalendarClock },
  { to: "/library", label: "Biblioteca", icon: Library },
  { to: "/settings", label: "Configurações", icon: Settings },
] as const;

type Profile = { display_name: string | null; avatar_url: string | null };

export function AppSidebar({
  mobileOpen,
  onMobileClose,
}: {
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!mounted || !data.user) return;
      setEmail(data.user.email ?? null);
      const { data: p } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", data.user.id)
        .maybeSingle();
      if (mounted && p) setProfile(p);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Até logo!");
    navigate({ to: "/auth", replace: true });
  };

  const displayName = profile?.display_name ?? email?.split("@")[0] ?? "Você";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-surface/80 backdrop-blur-xl transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-5">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary shadow-glow">
              <Logo className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-lg font-bold">ShopeeFlow</span>
          </Link>
          <button
            onClick={onMobileClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 px-3">
          <div className="px-2 pb-2 pt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Menu
          </div>
          {nav.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onMobileClose}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "bg-gradient-primary text-primary-foreground shadow-glow"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <item.icon
                  className={cn(
                    "h-4 w-4 transition-transform",
                    active ? "" : "group-hover:scale-110",
                  )}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User card */}
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-3 rounded-lg bg-surface-elevated p-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-primary text-sm font-semibold text-primary-foreground">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{displayName}</p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
              aria-label="Sair"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
