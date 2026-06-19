import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, LOCALES, type Locale } from "@/lib/i18n";
import { ArrowLeft, LogOut, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile/settings")({
  head: () => ({ meta: [{ title: "Mesh — Definições" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { t, locale, setLocale } = useI18n();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [nickname, setNickname] = useState("");
  const [bio, setBio] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(data);
      setNickname(data?.nickname ?? "");
      setBio(data?.bio ?? "");
      setIsPrivate(!!data?.is_private);
    })();
  }, []);

  const nicknameChanged = profile && nickname !== profile.nickname;
  const daysSinceNick = profile
    ? (Date.now() - new Date(profile.last_nickname_update).getTime()) / (1000 * 60 * 60 * 24)
    : 0;
  const nicknameLocked = nicknameChanged && daysSinceNick < 14;

  async function save() {
    if (!profile) return;
    if (nicknameLocked) return toast.error(t("settings.nicknameLockedDays"));
    setSaving(true);
    const patch: any = { bio, is_private: isPrivate, language: locale };
    if (nicknameChanged) {
      patch.nickname = nickname.trim();
      patch.last_nickname_update = new Date().toISOString();
    }
    const { error } = await supabase.from("profiles").update(patch).eq("id", profile.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("✓");
    navigate({ to: "/profile" });
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function deleteAccount() {
    if (!confirm("Eliminar conta? Esta ação é irreversível.")) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    // Cascade via profiles FK on auth.users.id wouldn't run; we delete profile rows (cascades posts/etc)
    await supabase.from("profiles").delete().eq("id", user.id);
    await supabase.auth.signOut();
    toast.success("Conta eliminada");
    navigate({ to: "/auth", replace: true });
  }

  if (!profile) return <p className="p-8 text-center text-muted-foreground">{t("common.loading")}</p>;

  return (
    <div>
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-3 py-3 flex items-center gap-2">
        <Link to="/profile" className="p-2 -ml-1 rounded-full hover:bg-secondary">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-semibold">{t("settings.title")}</h1>
      </header>

      <div className="p-4 space-y-5">
        <Field label={t("settings.nickname")}>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={20}
            className="w-full bg-input border border-border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {nicknameLocked && (
            <p className="text-xs text-destructive mt-1">{t("settings.nicknameLockedDays")}</p>
          )}
        </Field>

        <Field label={t("settings.bio")}>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={160}
            rows={3}
            className="w-full bg-input border border-border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
        </Field>

        <label className="flex items-center justify-between">
          <span className="text-sm">{t("settings.privacy")}</span>
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
            className="h-5 w-5 accent-primary"
          />
        </label>

        <Field label={t("settings.language")}>
          <div className="grid grid-cols-2 gap-2">
            {LOCALES.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => setLocale(l.code as Locale)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm ${
                  locale === l.code ? "border-primary bg-primary/10" : "border-border"
                }`}
              >
                <span className="text-xl">{l.flag}</span>
                <span className="truncate">{l.label}</span>
              </button>
            ))}
          </div>
        </Field>

        <button
          onClick={save}
          disabled={saving || nicknameLocked}
          className="w-full rounded-xl bg-primary text-primary-foreground font-medium py-3 disabled:opacity-40"
        >
          {t("settings.save")}
        </button>

        <div className="pt-4 border-t border-border space-y-2">
          <button
            onClick={signOut}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-secondary py-3"
          >
            <LogOut className="h-4 w-4" /> {t("settings.logout")}
          </button>
          <button
            onClick={deleteAccount}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-destructive text-destructive py-3"
          >
            <Trash2 className="h-4 w-4" /> {t("settings.deleteAccount")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wide text-muted-foreground block mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}
