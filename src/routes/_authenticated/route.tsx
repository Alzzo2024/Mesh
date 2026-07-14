import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { OnboardingOverlay } from "@/components/OnboardingOverlay";
import { SideBlocks } from "@/components/SideBlocks";

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
  const path = useRouterState({ select: (s) => s.location.pathname });
  // Only show the SideBlocks aside on feed & search (desktop); other pages get the space back.
  const showAside = path === "/feed" || path.startsWith("/feed/") || path === "/search" || path.startsWith("/search/");

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex w-full max-w-[1400px] items-start">
        <BottomNav />
        <main className="flex-1 min-w-0 border-x border-border pb-20 md:pb-0 min-h-screen">
          <Outlet />
        </main>
        {showAside && (
          <aside className="hidden lg:block sticky top-0 h-screen w-80 shrink-0 overflow-y-auto py-4 px-4">
            <SideBlocks />
          </aside>
        )}
      </div>
      <OnboardingOverlay />
    </div>
  );
}
