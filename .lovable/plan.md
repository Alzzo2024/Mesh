# Mesh v2.2.0 — plano faseado

Escolheste os 4 blocos. Fazer tudo num turno único garante regressões (schema de `posts` muda muito, RLS de storage muda, composer é reescrito). Proponho 4 turnos, cada um deixa a app estável e testável.

## Fase 1 — Correções rápidas + login flexível (turno 1)

Sem migrações pesadas. Ganhos imediatos.

- **Login por email / username / #fixed_id + palavra-passe**
  - `auth.tsx`: um único campo "Email, @username ou #ID". Se começa por `#` → lookup em `profiles.fixed_id`, se começa por `@` ou não tem `@` → lookup em `profiles.nickname`, senão é email. Server fn `resolve_login_email(identifier)` (SECURITY DEFINER, retorna email de `auth.users` via join com `profiles`) para não expor emails ao cliente.
- **Fix avatar de grupo na lista de conversas**
  - `conversations.tsx`: já lê `avatar_url` mas usa signed URL só no header. Passar por `SignedImage`/`resolveSignedUrl` também no item da lista.
- **Tabs PC maiores + deslocadas à esquerda**
  - `_authenticated/route.tsx` + `BottomNav.tsx`: aumentar largura da coluna esquerda (`w-64` → `w-72`), font-size das labels, alinhar `max-w` do grid para mover o feed ligeiramente à direita.
- **Link de post clicável no chat**
  - `conversations.$id.tsx`: no render de mensagens, detectar URLs `/(post|u)/…` do próprio domínio e renderizar como `<Link>` do TanStack; para outras URLs, `<a target="_blank" rel="noopener">`.
- **Botão "Traduzir" ao lado da data no PostCard**
  - `PostCard.tsx`: botão que chama server fn `translatePost({ text, targetLang })` usando Lovable AI Gateway (`google/gemini-2.5-flash`). Toggle mostra original ↔ tradução. `targetLang` vem do `useI18n().lang`.
- **Versão** → `V.2.2.0-α1` em `i18n.tsx`.

## Fase 2 — Comentários com resposta profunda + imagem + paste (turno 2)

- Adicionar `image_path text null` a `comments` (migração). Grants + policy já existem.
- `PostCard.tsx` (secção de comentários): editor com paste-handler (`onPaste` lê `clipboardData.files`), upload para `post-media/<user>/comments/<ts>`, miniatura clicável que abre `ImageLightbox`.
- Manter thread flatten mas guardar `parent_comment_id` no reply para preservar contexto ("respondendo a @x"). Responder a qualquer nível fica no mesmo thread root.
- Traduzir também disponível por comentário.

## Fase 3 — Media múltiplo + vídeo + paste no composer (turno 3)

Reescreve o modelo de media. Retro-compatível: `image_path` continua a existir como shortcut da 1ª imagem.

- Nova tabela `post_media(post_id, position, path, kind 'image'|'video'|'gif', width, height, duration_ms)`. Grants + RLS ligada a `posts`.
- `PostComposer.tsx`: aceitar até 10 ficheiros, drag+drop, `onPaste`. Vídeos limitados a 40 MB e 60 s (validado client-side). Preview em grid.
- `PostCard.tsx`: renderiza grid 1/2/3/4+ com carousel (setas + swipe) quando >4. Vídeo com `<video controls playsInline>`, autoplay muted quando visível (IntersectionObserver). Ícone de "carrossel" no canto quando >1 media em grelhas de perfil.
- OG tags dinâmicos na rota `post.$id.tsx` via `head()` alimentado pelo loader — usa primeira imagem / thumb do vídeo → preview correto no Discord.
- Storage: policy em `post-media` já permite upload autenticado; limite server-side de 40 MB via `supabase--storage_update_bucket` + `file_size_limit`.

## Fase 4 — Reposts com comentário + enquetes + performance (turno 4)

- **Repost com comentário**: adicionar `quote_post_id uuid null` e `content` já existe. UI: menu "Repostar" abre composer pré-carregado com card do post original embebido, submetido como novo post com `quote_post_id`. `PostCard.tsx` renderiza citação inline (só media/leitura, não interativo).
- **Enquetes**:
  - `polls(post_id pk, expires_at timestamptz, allow_multi bool)`
  - `poll_options(id, poll_id, position, label)`
  - `poll_votes(poll_id, option_id, user_id pk composto)`
  - RPC `vote_poll(_option uuid)` valida `expires_at > now()`.
  - Composer: aba "Enquete" com 2–5 opções, expira em minutos/horas/dias (nunca segundos). PostCard: barras % + tempo restante.
- **Performance**:
  - Substituir loops de `resolveSignedUrl` por batch: novo `resolveSignedUrls(paths[])` que faz `createSignedUrls` numa call por bucket.
  - Virtualização do feed em mobile (`@tanstack/react-virtual`).
  - `React.memo` no `PostCard` + estabilidade de callbacks.
  - Adiar `EmojiPicker` e `ImageLightbox` com `React.lazy`.
  - `<img loading="lazy" decoding="async">` em todas as media do feed.

---

## Resposta rápida agora

Confirmas para eu começar já pela **Fase 1** neste turno? Ou preferes começar por outra fase primeiro (ex.: Fase 3 media, que é a que mais notas o valor)?
