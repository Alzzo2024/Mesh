import { useEffect, useState } from "react";
import { MessageCircle, Search, ShieldCheck, Users, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MeshWord } from "@/components/Logo";
import { useI18n } from "@/lib/i18n";

export function OnboardingOverlay() {
  const { t } = useI18n();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !active) return;
      const { data } = await supabase
        .from("profiles")
        .select("id, onboarded_at")
        .eq("id", user.id)
        .maybeSingle();
      if (!active || !data) return;
      setProfileId(data.id);
      setOpen(!data.onboarded_at);
    })();
    return () => {
      active = false;
    };
  }, []);

  async function close() {
    setOpen(false);
    if (profileId) {
      await supabase.from("profiles").update({ onboarded_at: new Date().toISOString() }).eq("id", profileId);
    }
  }

  if (!open) return null;

  const items = [
    { icon: Users, title: t("onboarding.followTitle"), body: t("onboarding.followBody") },
    { icon: Search, title: t("onboarding.searchTitle"), body: t("onboarding.searchBody") },
    { icon: MessageCircle, title: t("onboarding.chatTitle"), body: t("onboarding.chatBody") },
    { icon: ShieldCheck, title: t("onboarding.trustTitle"), body: t("onboarding.trustBody") },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-background/85 px-3 pb-3 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{t("onboarding.welcome")}</p>
            <h2 className="mt-1 text-4xl text-primary">
              <MeshWord />
            </h2>
          </div>
          <button onClick={close} className="rounded-full p-2 text-muted-foreground hover:bg-secondary" aria-label={t("common.cancel")}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3">
          {items.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{body}</p>
              </div>
            </div>
          ))}
        </div>
        <button onClick={close} className="mt-5 w-full rounded-xl bg-primary py-3 font-medium text-[#1a1a1a]">
          {t("onboarding.start")}
        </button>
      </div>
    </div>
  );
}