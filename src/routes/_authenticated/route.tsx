import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Menu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/app-sidebar";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background bg-gradient-mesh">
      <div className="flex min-h-screen">
        <AppSidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile topbar */}
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md lg:hidden">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-md p-2 text-muted-foreground hover:bg-accent"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="font-display font-semibold">ShopeeFlow</span>
          </header>

          <main className="flex-1 p-4 md:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
