ALTER FUNCTION public.get_or_create_direct_conversation(uuid) SECURITY INVOKER;
REVOKE EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) FROM PUBLIC, anon, authenticated;