import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MeshWord } from "@/components/Logo";

export const Route = createFileRoute("/")({
  ssr: false,
  component: IndexRedirect,
});

function IndexRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      navigate({ to: data.session ? "/feed" : "/auth", replace: true });
    });

    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="text-center">
        <h1 className="text-6xl text-primary">
          <MeshWord />
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">A carregar…</p>
      </div>
    </main>
  );
}
