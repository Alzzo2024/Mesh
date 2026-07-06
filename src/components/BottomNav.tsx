import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Flame, Search, MessageCircle, User, Bell, Pencil, Bookmark, Settings } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { MeshWord } from "@/components/Logo";
import { useUnreadCounts } from "@/lib/use-unread";

export function BottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { t } = useI18n();
  const unread = useUnreadCounts();
  const navigate = useNavigate();

  const mobileItems = [
    { to: "/feed", icon: Flame, label: t("nav.feed"), dot: 0 },
    { to: "/search", icon: Search, label: t("nav.search"), dot: 0 },
    { to: "/conversations", icon: MessageCircle, label: t("nav.chats"), dot: unread.messages },
    { to: "/notifications", icon: Bell, label: t("nav.notifications"), dot: unread.notifications },
    { to: "/profile", icon: User, label: t("nav.profile"), dot: 0 },
  ] as const;

  const desktopItems = [
    { to: "/feed", icon: Flame, label: t("nav.feed"), dot: 0 },
    { to: "/search", icon: Search, label: t("nav.search"), dot: 0 },
    { to: "/conversations", icon: MessageCircle, label: t("nav.chats"), dot: unread.messages },
    { to: "/notifications", icon: Bell, label: t("nav.notifications"), dot: unread.notifications },
    { to: "/saved", icon: Bookmark, label: t("nav.saved"), dot: 0 },
    { to: "/profile", icon: User, label: t("nav.profile"), dot: 0 },
  ] as const;

  function openComposer() {
    if (path !== "/feed") navigate({ to: "/feed" });
    setTimeout(() => window.dispatchEvent(new CustomEvent("mesh:open-composer")), 50);
  }

  return (
    <>
      {/* Mobile bottom nav — icons only */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto max-w-xl grid grid-cols-5">
          {mobileItems.map(({ to, icon: Icon, label, dot }) => {
            const active = path === to || path.startsWith(to + "/");
            return (
              <li key={to}>
                <Link
                  to={to}
                  aria-label={label}
                  className={`relative flex items-center justify-center py-3 ${
                    active ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <Icon className="h-6 w-6" />
                  {dot > 0 && (
                    <span className="absolute top-2 right-[calc(50%-14px)] h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-background" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed top-0 left-0 h-screen w-60 z-40 border-r border-border bg-background/95 backdrop-blur flex-col py-6 px-4">
        <Link to="/feed" className="px-3 mb-8">
          <MeshWord className="text-3xl text-primary" />
        </Link>
        <ul className="flex flex-col gap-1">
          {desktopItems.map(({ to, icon: Icon, label, dot }) => {
            const active = path === to || path.startsWith(to + "/");
            return (
              <li key={to}>
                <Link
                  to={to}
                  className={`relative flex items-center gap-3 rounded-full px-4 py-3 text-base transition-colors ${
                    active ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-secondary"
                  }`}
                >
                  <span className="relative">
                    <Icon className="h-5 w-5" />
                    {dot > 0 && (
                      <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-background" />
                    )}
                  </span>
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <button
          onClick={openComposer}
          className="mt-4 flex items-center justify-center gap-2 rounded-full bg-primary text-[#1a1a1a] font-semibold py-3 hover:opacity-90 transition"
        >
          <Pencil className="h-4 w-4" />
          {t("feed.post")}
        </button>
      </aside>
    </>
  );
}

