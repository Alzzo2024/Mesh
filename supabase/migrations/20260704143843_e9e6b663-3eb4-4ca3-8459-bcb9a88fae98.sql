REVOKE EXECUTE ON FUNCTION public.cleanup_reaction_notification() FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_repost_notification() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_on_comment() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_on_follow() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_on_reaction() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_on_repost() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_conversation_meta(uuid, text, text) FROM anon;

REVOKE EXECUTE ON FUNCTION public.cleanup_reaction_notification() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_repost_notification() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_comment() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_follow() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_reaction() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_repost() FROM authenticated;

GRANT EXECUTE ON FUNCTION public.update_conversation_meta(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_reaction_notification() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_repost_notification() TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_on_comment() TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_on_follow() TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_on_reaction() TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_on_repost() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_conversation_meta(uuid, text, text) TO service_role;