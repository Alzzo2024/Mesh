import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Locale = "pt-PT" | "pt-BR" | "es-ES" | "fr-FR" | "fr-CA" | "de-DE" | "it-IT" | "en-GB" | "en-US";

export const APP_VERSION = "V.2.0.0";

export const LOCALES: { code: Locale; label: string; flag: string }[] = [
  { code: "pt-PT", label: "Português", flag: "🇵🇹" },
  { code: "pt-BR", label: "Português (BR)", flag: "🇧🇷" },
  { code: "es-ES", label: "Castellano", flag: "🇪🇸" },
  { code: "fr-FR", label: "Français", flag: "🇫🇷" },
  { code: "fr-CA", label: "Français (CA)", flag: "🇨🇦" },
  { code: "de-DE", label: "Deutsch", flag: "🇩🇪" },
  { code: "it-IT", label: "Italiano", flag: "🇮🇹" },
  { code: "en-GB", label: "English", flag: "🇬🇧" },
  { code: "en-US", label: "English (US)", flag: "🇺🇸" },
];

type Dict = Record<string, string>;

const ptPT: Dict = {
  "nav.feed": "Feed",
  "nav.search": "Pesquisar",
  "nav.chats": "Conversas",
  "nav.notifications": "Notificações",
  "nav.profile": "Perfil",
  "auth.signin": "Entrar",
  "auth.signup": "Criar conta",
  "auth.email": "Email",
  "auth.password": "Palavra-passe",
  "auth.nickname": "Nome de utilizador",
  "auth.toggle.toSignup": "Não tens conta? Criar uma",
  "auth.toggle.toSignin": "Já tens conta? Entrar",
  "auth.welcome": "Bem-vindo ao",
  "feed.placeholder": "O que se passa?",
  "feed.post": "Publicar",
  "feed.empty": "Ainda não há publicações. Sê o primeiro!",
  "feed.comments": "Comentários",
  "feed.commentPlaceholder": "Escreve um comentário…",
  "feed.replyPlaceholder": "Escreve uma resposta…",
  "feed.send": "Enviar",
  "feed.reply": "Responder",
  "feed.delete": "Apagar",
  "feed.actions": "Opções da publicação",
  "feed.edit": "Editar",
  "feed.deletePostConfirm": "Apagar esta publicação?",
  "feed.deleteCommentConfirm": "Apagar este comentário?",
  "feed.addImage": "Adicionar imagem",
  "feed.removeImage": "Remover imagem",
  "feed.newPost": "Nova publicação",
  "search.placeholder": "Pesquisar pessoas, posts ou #hashtags",
  "search.people": "Pessoas",
  "search.posts": "Publicações",
  "search.empty": "Sem resultados.",
  "search.start": "Escreve para pesquisar.",
  "follow.follow": "Seguir",
  "follow.unfollow": "A seguir",
  "follow.followers": "Seguidores",
  "follow.following": "A seguir",
  "follow.noFollowers": "Ainda sem seguidores.",
  "follow.noFollowing": "Ainda não segues ninguém.",
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
  "chats.delete": "Eliminar conversa",
  "chats.deleteConfirm": "Eliminar esta conversa? Esta ação é irreversível.",
  "chats.addMember": "Adicionar pessoa",
  "chat.placeholder": "Mensagem…",
  "chat.reply": "Responder",
  "chat.react": "Reagir",
  "chat.replyingTo": "A responder",
  "chat.imageSelected": "Imagem escolhida",
  "notifs.title": "Notificações",
  "notifs.empty": "Sem notificações.",
  "notifs.comment": "comentou na tua publicação",
  "notifs.like": "gostou da tua publicação",
  "notifs.dislike": "deu não gosto na tua publicação",
  "notifs.follow": "começou a seguir-te",
  "notifs.markAllRead": "Marcar tudo como lido",
  "profile.posts": "Publicações",
  "profile.comments": "Comentários",
  "profile.gallery": "Galeria",
  "profile.addToGallery": "Adicionar screenshot",
  "profile.settings": "Definições",
  "profile.editAppearance": "Configurações",
  "feed.pin": "Afixar publicação",
  "feed.unpin": "Desafixar",
  "feed.pinned": "Afixado",
  "feed.pinLimit": "Máximo de 3 publicações afixadas.",
  "feed.share": "Partilhar",
  "feed.copyLink": "Copiar link",
  "feed.shareToChat": "Enviar para conversa",
  "feed.linkCopied": "Link copiado",
  "notifs.mention": "mencionou-te numa publicação",
  "settings.title": "Definições",
  "settings.nickname": "Nome de utilizador",
  "settings.bio": "Bio",
  "settings.avatar": "Foto de perfil",
  "settings.banner": "Banner",
  "settings.changePhoto": "Mudar foto",
  "settings.changeBanner": "Mudar banner",
  "settings.privacy": "Conta privada",
  "settings.language": "Idioma",
  "settings.save": "Guardar",
  "settings.logout": "Terminar sessão",
  "settings.deleteAccount": "Eliminar conta",
  "settings.deleteAccountConfirm": "Eliminar conta? Esta ação é irreversível.",
  "settings.nicknameLockedDays": "Só podes mudar o nome de utilizador a cada 14 dias.",
  "settings.version": "Versão",
  "common.cancel": "Cancelar",
  "common.back": "Voltar",
  "common.you": "Tu",
  "common.loading": "A carregar…",
  "common.delete": "Eliminar",
  "common.add": "Adicionar",
  "post.title": "Publicação",
  "trust.title": "Confiança",
  "trust.give": "Dar confiança",
  "trust.voted": "Confiança dada.",
  "trust.weeklyUsed": "Já deste o teu voto de confiança desta semana.",
  "creator.title": "Criador do Mesh",
  "onboarding.welcome": "Bem-vindo ao",
  "onboarding.followTitle": "Segue pessoas",
  "onboarding.followBody": "Encontra perfis, segue quem gostas e vê publicações no feed.",
  "onboarding.searchTitle": "Pesquisa tudo",
  "onboarding.searchBody": "Procura pessoas, publicações e hashtags para descobrir conversas.",
  "onboarding.chatTitle": "Conversa em privado",
  "onboarding.chatBody": "Adiciona amigos por ID, cria grupos e envia mensagens com imagens.",
  "onboarding.trustTitle": "Confiança semanal",
  "onboarding.trustBody": "Uma vez por semana podes dar confiança a uma pessoa.",
  "onboarding.start": "Começar",
  "error.generic": "Algo correu mal.",
};

const ptBR: Dict = { ...ptPT, "feed.placeholder": "O que está rolando?", "auth.toggle.toSignup": "Não tem conta? Criar uma", "auth.toggle.toSignin": "Já tem conta? Entrar" };

const enGB: Dict = {
  ...ptPT,
  "nav.feed": "Feed", "nav.search": "Search", "nav.chats": "Chats", "nav.notifications": "Notifications", "nav.profile": "Profile",
  "auth.signin": "Sign in", "auth.signup": "Create account", "auth.email": "Email", "auth.password": "Password", "auth.nickname": "Username",
  "auth.toggle.toSignup": "No account? Create one", "auth.toggle.toSignin": "Already have an account? Sign in", "auth.welcome": "Welcome to",
  "feed.placeholder": "What's happening?", "feed.post": "Post", "feed.empty": "No posts yet. Be the first!", "feed.newPost": "New post",
  "feed.delete": "Delete", "feed.edit": "Edit", "feed.reply": "Reply", "feed.commentPlaceholder": "Write a comment…", "feed.replyPlaceholder": "Write a reply…",
  "feed.deletePostConfirm": "Delete this post?", "feed.deleteCommentConfirm": "Delete this comment?",
  "search.placeholder": "Search people, posts or #hashtags", "search.people": "People", "search.posts": "Posts",
  "chats.title": "Chats", "chats.addFriend": "Add friend", "chats.friends": "Friends", "chats.newGroup": "New group",
  "chats.groupName": "Group name", "chats.create": "Create", "chats.delete": "Delete chat", "chats.deleteConfirm": "Delete this chat? This cannot be undone.",
  "chats.addMember": "Add member",
  "chat.placeholder": "Message…",
  "notifs.title": "Notifications", "notifs.empty": "No notifications.", "notifs.comment": "commented on your post",
  "notifs.like": "liked your post", "notifs.dislike": "disliked your post", "notifs.follow": "started following you",
  "notifs.markAllRead": "Mark all as read",
  "profile.posts": "Posts", "profile.comments": "Comments", "profile.gallery": "Gallery", "profile.addToGallery": "Add screenshot",
  "profile.settings": "Settings", "profile.editAppearance": "Settings",
  "feed.pin": "Pin post", "feed.unpin": "Unpin", "feed.pinned": "Pinned", "feed.pinLimit": "Max 3 pinned posts.",
  "feed.share": "Share", "feed.copyLink": "Copy link", "feed.shareToChat": "Send to chat", "feed.linkCopied": "Link copied",
  "notifs.mention": "mentioned you in a post",
  "settings.title": "Settings", "settings.nickname": "Username", "settings.bio": "Bio", "settings.language": "Language",
  "settings.save": "Save", "settings.logout": "Sign out", "settings.deleteAccount": "Delete account",
  "settings.deleteAccountConfirm": "Delete account? This cannot be undone.", "settings.version": "Version",
  "common.cancel": "Cancel", "common.back": "Back", "common.loading": "Loading…", "common.delete": "Delete", "common.add": "Add",
};

const enUS: Dict = { ...enGB };
const esES: Dict = { ...enGB,
  "nav.feed":"Feed","nav.search":"Buscar","nav.chats":"Chats","nav.notifications":"Notificaciones","nav.profile":"Perfil",
  "auth.welcome":"Bienvenido a","feed.placeholder":"¿Qué está pasando?","feed.post":"Publicar","feed.newPost":"Nueva publicación",
  "chats.title":"Chats","chats.delete":"Eliminar chat","chats.addMember":"Añadir miembro",
  "notifs.title":"Notificaciones","settings.title":"Ajustes","settings.language":"Idioma","settings.version":"Versión",
};
const itIT: Dict = { ...enGB,
  "nav.feed":"Feed","nav.search":"Cerca","nav.chats":"Chat","nav.notifications":"Notifiche","nav.profile":"Profilo",
  "auth.welcome":"Benvenuto su","feed.placeholder":"Cosa succede?","feed.post":"Pubblica","feed.newPost":"Nuovo post",
  "chats.title":"Chat","chats.delete":"Elimina chat","chats.addMember":"Aggiungi membro",
  "notifs.title":"Notifiche","settings.title":"Impostazioni","settings.language":"Lingua","settings.version":"Versione",
};
const deDE: Dict = { ...enGB,
  "nav.feed":"Feed","nav.search":"Suche","nav.chats":"Chats","nav.notifications":"Mitteilungen","nav.profile":"Profil",
  "auth.welcome":"Willkommen bei","feed.placeholder":"Was gibt's Neues?","feed.post":"Posten","feed.newPost":"Neuer Beitrag",
  "chats.title":"Chats","chats.delete":"Chat löschen","chats.addMember":"Mitglied hinzufügen",
  "notifs.title":"Mitteilungen","settings.title":"Einstellungen","settings.language":"Sprache","settings.version":"Version",
};
const frFR: Dict = { ...enGB,
  "nav.feed":"Fil","nav.search":"Rechercher","nav.chats":"Discussions","nav.notifications":"Notifications","nav.profile":"Profil",
  "auth.welcome":"Bienvenue sur","feed.placeholder":"Quoi de neuf ?","feed.post":"Publier","feed.newPost":"Nouvelle publication",
  "chats.title":"Discussions","chats.delete":"Supprimer la discussion","chats.addMember":"Ajouter un membre",
  "notifs.title":"Notifications","settings.title":"Paramètres","settings.language":"Langue","settings.version":"Version",
};
const frCA: Dict = { ...frFR };

const DICTS: Record<Locale, Dict> = {
  "pt-PT": ptPT, "pt-BR": ptBR, "es-ES": esES, "fr-FR": frFR, "fr-CA": frCA,
  "de-DE": deDE, "it-IT": itIT, "en-GB": enGB, "en-US": enUS,
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
  const t = (k: string) => DICTS[locale][k] ?? DICTS["pt-PT"][k] ?? DICTS["en-GB"][k] ?? k;
  return <Ctx.Provider value={{ locale, setLocale, t }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useI18n must be used inside I18nProvider");
  return c;
}
