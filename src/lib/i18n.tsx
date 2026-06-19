import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Locale = "pt-PT" | "pt-BR" | "en-GB" | "en-US";

export const LOCALES: { code: Locale; label: string; flag: string }[] = [
  { code: "pt-PT", label: "Português (Portugal)", flag: "🇵🇹" },
  { code: "pt-BR", label: "Português (Brasil)", flag: "🇧🇷" },
  { code: "en-GB", label: "English (UK)", flag: "🇬🇧" },
  { code: "en-US", label: "English (US)", flag: "🇺🇸" },
];

type Dict = Record<string, string>;

const ptPT: Dict = {
  "app.tagline": "Rede social minimalista",
  "nav.feed": "Feed",
  "nav.chats": "Conversas",
  "nav.profile": "Perfil",
  "auth.signin": "Entrar",
  "auth.signup": "Criar conta",
  "auth.email": "Email",
  "auth.password": "Palavra-passe",
  "auth.nickname": "Nome de utilizador",
  "auth.toggle.toSignup": "Não tens conta? Criar uma",
  "auth.toggle.toSignin": "Já tens conta? Entrar",
  "auth.welcome": "Bem-vindo à",
  "feed.placeholder": "O que se passa?",
  "feed.post": "Publicar",
  "feed.empty": "Ainda não há publicações. Sê o primeiro!",
  "feed.comments": "Comentários",
  "feed.commentPlaceholder": "Escreve um comentário…",
  "feed.send": "Enviar",
  "chats.title": "Conversas",
  "chats.addFriend": "Adicionar amigo",
  "chats.fixedIdPlaceholder": "ID fixo (6 caracteres)",
  "chats.send": "Enviar pedido",
  "chats.requests": "Pedidos",
  "chats.friends": "Amigos",
  "chats.noFriends": "Adiciona amigos pelo ID fixo para conversar.",
  "chats.noRequests": "Sem pedidos pendentes.",
  "chats.accept": "Aceitar",
  "chats.reject": "Recusar",
  "chats.newGroup": "Novo grupo",
  "chats.groupName": "Nome do grupo",
  "chats.create": "Criar",
  "chat.placeholder": "Mensagem…",
  "profile.posts": "Publicações",
  "profile.comments": "Comentários",
  "profile.settings": "Definições",
  "settings.title": "Definições",
  "settings.nickname": "Nome de utilizador",
  "settings.bio": "Bio",
  "settings.privacy": "Conta privada",
  "settings.language": "Idioma",
  "settings.save": "Guardar",
  "settings.logout": "Terminar sessão",
  "settings.deleteAccount": "Eliminar conta",
  "settings.nicknameLockedDays": "Só podes mudar o nome de utilizador a cada 14 dias.",
  "common.cancel": "Cancelar",
  "common.back": "Voltar",
  "common.you": "Tu",
  "common.loading": "A carregar…",
  "error.generic": "Algo correu mal.",
};

const ptBR: Dict = {
  ...ptPT,
  "feed.placeholder": "O que está rolando?",
  "auth.toggle.toSignup": "Não tem conta? Criar uma",
  "auth.toggle.toSignin": "Já tem conta? Entrar",
  "settings.nicknameLockedDays": "Você só pode mudar o nome de usuário a cada 14 dias.",
  "chats.noFriends": "Adicione amigos pelo ID fixo para conversar.",
};

const enGB: Dict = {
  "app.tagline": "A minimalist social network",
  "nav.feed": "Feed",
  "nav.chats": "Chats",
  "nav.profile": "Profile",
  "auth.signin": "Sign in",
  "auth.signup": "Create account",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.nickname": "Username",
  "auth.toggle.toSignup": "No account? Create one",
  "auth.toggle.toSignin": "Already have an account? Sign in",
  "auth.welcome": "Welcome to",
  "feed.placeholder": "What's happening?",
  "feed.post": "Post",
  "feed.empty": "No posts yet. Be the first!",
  "feed.comments": "Comments",
  "feed.commentPlaceholder": "Write a comment…",
  "feed.send": "Send",
  "chats.title": "Chats",
  "chats.addFriend": "Add friend",
  "chats.fixedIdPlaceholder": "Fixed ID (6 chars)",
  "chats.send": "Send request",
  "chats.requests": "Requests",
  "chats.friends": "Friends",
  "chats.noFriends": "Add friends by fixed ID to start chatting.",
  "chats.noRequests": "No pending requests.",
  "chats.accept": "Accept",
  "chats.reject": "Decline",
  "chats.newGroup": "New group",
  "chats.groupName": "Group name",
  "chats.create": "Create",
  "chat.placeholder": "Message…",
  "profile.posts": "Posts",
  "profile.comments": "Comments",
  "profile.settings": "Settings",
  "settings.title": "Settings",
  "settings.nickname": "Username",
  "settings.bio": "Bio",
  "settings.privacy": "Private account",
  "settings.language": "Language",
  "settings.save": "Save",
  "settings.logout": "Sign out",
  "settings.deleteAccount": "Delete account",
  "settings.nicknameLockedDays": "You can only change your username every 14 days.",
  "common.cancel": "Cancel",
  "common.back": "Back",
  "common.you": "You",
  "common.loading": "Loading…",
  "error.generic": "Something went wrong.",
};

const enUS: Dict = { ...enGB };

const DICTS: Record<Locale, Dict> = {
  "pt-PT": ptPT,
  "pt-BR": ptBR,
  "en-GB": enGB,
  "en-US": enUS,
};

type I18nCtx = { locale: Locale; setLocale: (l: Locale) => void; t: (k: string) => string };
const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("pt-PT");

  useEffect(() => {
    const stored = (typeof window !== "undefined" && (localStorage.getItem("mesh.locale") as Locale)) || null;
    if (stored && DICTS[stored]) setLocaleState(stored);
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    if (typeof window !== "undefined") localStorage.setItem("mesh.locale", l);
  };

  const t = (k: string) => DICTS[locale][k] ?? DICTS["en-GB"][k] ?? k;
  return <Ctx.Provider value={{ locale, setLocale, t }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useI18n must be used inside I18nProvider");
  return c;
}
