ALTER FUNCTION public.get_or_create_direct_conversation(uuid) SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) TO authenticated;