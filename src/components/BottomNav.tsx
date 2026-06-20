import { Link, useRouterState } from "@tanstack/react-router";
import { FlameKindling, Search, MessageCircle, User } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function BottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { t } = useI18n();

  const items = [
    { to: "/feed", icon: FlameKindling, label: t("nav.feed") },
    { to: "/search", icon: Search, label: t("nav.search") },
    { to: "/conversations", icon: MessageCircle, label: t("nav.chats") },
    { to: "/profile", icon: User, label: t("nav.profile") },
  ] as const;

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur"
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
  );
}
