## Lote 3 — Conversas, Grupos, Permissões + Extras pedidos

### 1. Conversas e grupos (lote 3 base)
- Pesquisa no topo de `conversations.tsx` (filtra por nome/última mensagem).
- Pesquisa dentro de uma conversa (`conversations.$id.tsx`) — barra de procurar mensagens.
- Menu ⋯ por conversa: apagar (chama `delete_conversation`) e afixar (coluna nova `pinned_at` em `conversation_members`).
- Foto de grupo quadrada + ecrã de membros (lista + remover quando admin).
- Permissões só do owner: mudar nome, mudar foto, remover membros, adicionar.

### 2. Mudar `#FIXED_ID` para `@handle`
- Renomear visualmente todos os `#${fixed_id}` → `@${fixed_id}` (perfis, post cards, mentions, search, notifs).
- `resolveMentions` passa a reescrever `@nickname` → `@FIXED_ID` (não `#`), evita confusão com hashtags.
- Permitir mudar `nickname` a qualquer altura (remover lock de 14 dias).
- Permitir mudar `fixed_id` a cada 14 dias, até 10 caracteres alfanuméricos (nova coluna `last_fixed_id_update`, validação por trigger + UI em Configurações).

### 3. Repost
- Nova tabela `post_reposts(user_id, post_id, created_at, unique(user_id,post_id))` com RLS + GRANTs.
- Botão de repost no `PostCard` entre comentários e partilhar; toggle on/off; contador.
- Trigger `notify_on_repost` → notification tipo `repost` (adicionar ao enum `notification_type`).
- No perfil: reposts aparecem na lista de publicações (após pinned) com label "Repostado por @X" em vez de "Afixado". Contam para o feed do autor original também.

### 4. Link no perfil
- Coluna `link` (text, max 200, validar URL http/https) em `profiles`.
- Campo nas Configurações; render no perfil abaixo da bio com ícone.

### 5. Galeria de volta
- Tab "Galeria" entre Publicações e Comentários no `profile.tsx` e `u.$fixedId.tsx`.
- Grid 3x3 quadrada com todas as imagens/gifs publicadas pelo user (extrai de `posts.image_path`).
- Clique → lightbox (já existe).

### 6. Conversas: divisas de dia + formatos de hora
- Em `conversations.$id.tsx`, agrupar mensagens por dia: render `Hoje`, `Ontem`, ou data completa entre grupos.
- Mostrar apenas `HH:mm` (sem segundos) em mensagens, posts, comentários, notificações.

### 7. Botão Publicar
- Mobile: manter FAB.
- Desktop: mover o botão Publicar para a sidebar/menu abaixo do item "Perfil" (no `BottomNav`/sidebar nav desktop).

### 8. Notificações duplicadas
- Adicionar `unique(user_id, actor_id, type, post_id, comment_id)` ou semelhante para evitar inserts repetidos do trigger (acontece quando user dá like, tira e dá outra vez).
- Trigger `notify_on_reaction` passa a apagar notif antiga do mesmo (user, actor, post, type) antes de inserir, ou usa `ON CONFLICT DO NOTHING` com índice único parcial.

### 9. Versão
- `APP_VERSION` em `src/lib/i18n.tsx` → `V.2.0.0`.

### Migração SQL (resumida)
- `ALTER TABLE profiles ADD COLUMN link text, ADD COLUMN last_fixed_id_update timestamptz DEFAULT now()`.
- `ALTER TABLE conversation_members ADD COLUMN pinned_at timestamptz`.
- `CREATE TABLE post_reposts` + GRANTs + RLS + trigger de notificação.
- `ALTER TYPE notification_type ADD VALUE 'repost'` (em migração separada antes de usar).
- Índice único parcial em `notifications` para deduplicar (`user_id, actor_id, type, coalesce(post_id,...), coalesce(comment_id,...)`).
- Trigger de validação para `fixed_id` (14 dias, ≤10 chars, alfanum).
- Remover constraint/regra que limitava nickname a 14 dias (manter coluna `last_nickname_update` mas UI já não bloqueia).

### Notas
- Vou implementar tudo em paralelo, num único lote. Migração primeiro (precisa aprovação), código depois.
- Tema claro fica para o fim conforme combinado.

Confirmas para avançar?