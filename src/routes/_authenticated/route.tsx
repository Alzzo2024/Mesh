import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { OnboardingOverlay } from "@/components/OnboardingOverlay";

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
  return (
    <div className="min-h-screen pb-20 md:pb-0 md:pl-60 lg:pr-96">
      <div className="mx-auto max-w-xl">
        <Outlet />
      </div>
      <OnboardingOverlay />
      <BottomNav />
    </div>
  );
}
