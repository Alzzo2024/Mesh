import { Link, useRouterState } from "@tanstack/react-router";
import { Flame, Search, MessageCircle, User } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { MeshWord } from "@/components/Logo";

export function BottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { t } = useI18n();

  const items = [
    { to: "/feed", icon: Flame, label: t("nav.feed") },
    { to: "/search", icon: Search, label: t("nav.search") },
    { to: "/conversations", icon: MessageCircle, label: t("nav.chats") },
    { to: "/profile", icon: User, label: t("nav.profile") },
  ] as const;

  return (
    <>
      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto max-w-xl grid grid-cols-4">
          {items.map(({ to, icon: Icon, label }) => {
            const active = path === to || path.startsWith(to + "/");
            return (
              <li key={to}>
                <Link
                  to={to}
                  className={`flex flex-col items-center justify-center gap-1 py-2.5 text-xs ${
                    active ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed top-0 left-0 h-screen w-60 z-40 border-r border-border bg-background/95 backdrop-blur flex-col py-6 px-4">
        <Link to="/feed" className="px-3 mb-8">
          <MeshWord className="text-3xl" />
        </Link>
        <ul className="flex flex-col gap-1">
          {items.map(({ to, icon: Icon, label }) => {
            const active = path === to || path.startsWith(to + "/");
            return (
              <li key={to}>
                <Link
                  to={to}
                  className={`flex items-center gap-3 rounded-full px-4 py-3 text-base transition-colors ${
                    active
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-foreground hover:bg-secondary"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </aside>
    </>
  );
}
