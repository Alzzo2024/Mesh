import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, LogOut, Trash2, Camera, Globe, Check, Sun, Moon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, LOCALES, APP_VERSION, type Locale } from "@/lib/i18n";
import { Avatar } from "@/components/Avatar";
import { SignedImage } from "@/components/SignedImage";
import { ensureMyProfile } from "@/lib/profile";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile/settings")({
  head: () => ({ meta: [{ title: "Mesh — Definições" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { t, locale, setLocale } = useI18n();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [nickname, setNickname] = useState("");
  const [fixedId, setFixedId] = useState("");
  const [bio, setBio] = useState("");
  const [link, setLink] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  const currentLocale = LOCALES.find((l) => l.code === locale);

  async function load() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      const data = await ensureMyProfile(user);
      setProfile(data);
      setNickname(data?.nickname ?? "");
      setFixedId(data?.fixed_id ?? "");
      setBio(data?.bio ?? "");
      setLink((data as any)?.link ?? "");
      setIsPrivate(!!data?.is_private);
    } catch (error: any) {
      toast.error(error.message ?? t("error.generic"));
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function upload(bucket: "avatars" | "banners", file: File) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) return toast.error(error.message);
    const value = `${bucket}/${path}`;
    const patch = bucket === "avatars" ? { avatar_url: value } : { banner_url: value };
    await supabase.from("profiles").update(patch).eq("id", user.id);
    load();
  }

  const fixedIdChanged = profile && fixedId.toUpperCase() !== profile.fixed_id;
  const daysSinceFixedId = profile?.last_fixed_id_update
    ? (Date.now() - new Date(profile.last_fixed_id_update).getTime()) / (1000 * 60 * 60 * 24)
    : 999;
  const fixedIdLocked = fixedIdChanged && daysSinceFixedId < 14;
  const fixedIdValid = /^[A-Za-z0-9]{1,10}$/.test(fixedId);
  const linkValid = !link.trim() || /^https?:\/\/.{1,200}$/i.test(link.trim());

  async function save() {
    if (!profile) return;
    if (fixedIdChanged && fixedIdLocked) return toast.error(t("settings.fixedIdLocked"));
    if (fixedIdChanged && !fixedIdValid) return toast.error(t("settings.fixedIdHint"));
    if (!linkValid) return toast.error("URL inválido (http/https, máx. 200)");
    setSaving(true);
    const patch: any = {
      nickname: nickname.trim(),
      bio,
      link: link.trim() || null,
      is_private: isPrivate,
      language: locale,
    };
    if (nickname.trim() !== profile.nickname) {
      patch.last_nickname_update = new Date().toISOString();
    }
    if (fixedIdChanged) patch.fixed_id = fixedId.toUpperCase();
    const { error } = await supabase.from("profiles").update(patch).eq("id", profile.id);
    setSaving(false);
    if (error) {
      if (error.message.includes("FIXED_ID_LOCKED")) toast.error(t("settings.fixedIdLocked"));
      else if (error.message.includes("profiles_fixed_id_format")) toast.error(t("settings.fixedIdHint"));
      else if (error.message.includes("duplicate")) toast.error("@ID já está em uso");
      else toast.error(error.message);
      return;
    }
    toast.success("✓");
    navigate({ to: "/profile" });
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function deleteAccount() {
    if (!confirm(t("settings.deleteAccountConfirm"))) return;
    const { error } = await supabase.rpc("delete_my_account");
    if (error) return toast.error(error.message);
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (!loaded) return <p className="p-8 text-center text-muted-foreground">{t("common.loading")}</p>;
  if (!profile) return <p className="p-8 text-center text-muted-foreground">{t("error.generic")}</p>;

  return (
    <div>
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-3 py-3 flex items-center gap-2">
        <Link to="/profile" className="p-2 -ml-1 rounded-full hover:bg-secondary">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-semibold">{t("settings.title")}</h1>
      </header>

      <div className="relative h-32 bg-secondary">
        {profile.banner_url && (
          <SignedImage path={profile.banner_url} className="w-full h-full object-cover" />
        )}
        <button
          onClick={() => bannerRef.current?.click()}
          className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/50 transition-colors"
          aria-label={t("settings.changeBanner")}
        >
          <Camera className="h-6 w-6 text-white" />
        </button>
        <input
          ref={bannerRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && upload("banners", e.target.files[0])}
        />
      </div>

      <div className="px-4 -mt-10 relative">
        <div className="relative w-20 h-20">
          <Avatar url={profile.avatar_url} name={profile.nickname} size={80} className="ring-4 ring-background" />
          <button
            onClick={() => avatarRef.current?.click()}
            className="absolute bottom-0 right-0 rounded-full bg-primary text-[#1a1a1a] p-1.5"
            aria-label={t("settings.changePhoto")}
          >
            <Camera className="h-3 w-3" />
          </button>
          <input
            ref={avatarRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && upload("avatars", e.target.files[0])}
          />
        </div>
      </div>

      <div className="p-4 space-y-5">
        <Field label={t("settings.nickname")}>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={20}
            className="w-full bg-input border border-border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </Field>

        <Field label={t("settings.fixedId")}>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">@</span>
            <input
              value={fixedId}
              onChange={(e) => setFixedId(e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 10).toUpperCase())}
              maxLength={10}
              className="flex-1 bg-input border border-border rounded-xl px-4 py-2.5 font-mono uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">{t("settings.fixedIdHint")}</p>
          {fixedIdLocked && (
            <p className="text-xs text-destructive mt-1">{t("settings.fixedIdLocked")}</p>
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

        <Field label={t("settings.link")}>
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            maxLength={200}
            placeholder={t("settings.linkPlaceholder")}
            className="w-full bg-input border border-border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary"
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
          <button
            type="button"
            onClick={() => setLangOpen(true)}
            className="w-full flex items-center justify-between rounded-xl border border-border bg-input px-4 py-2.5"
          >
            <span className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="text-xl">{currentLocale?.flag}</span>
              <span>{currentLocale?.label}</span>
            </span>
            <span className="text-xs text-muted-foreground">›</span>
          </button>
        </Field>

        {langOpen && (
          <div
            className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setLangOpen(false)}
          >
            <div
              className="w-full md:max-w-sm rounded-t-2xl md:rounded-2xl bg-popover border border-border p-2 max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-3 py-2 text-sm font-medium text-muted-foreground">
                {t("settings.language")}
              </div>
              {LOCALES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => {
                    setLocale(l.code as Locale);
                    setLangOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left ${
                    locale === l.code ? "bg-primary/10 text-primary" : "hover:bg-secondary"
                  }`}
                >
                  <span className="text-2xl">{l.flag}</span>
                  <span className="flex-1">{l.label}</span>
                  {locale === l.code && <Check className="h-4 w-4" />}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={save}
          disabled={saving || fixedIdLocked || !fixedIdValid}
          className="w-full rounded-xl bg-primary text-[#1a1a1a] font-medium py-3 disabled:opacity-40"
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

        <p className="text-center text-xs text-muted-foreground pt-4">
          Mesh · {t("settings.version")} {APP_VERSION}
        </p>
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
