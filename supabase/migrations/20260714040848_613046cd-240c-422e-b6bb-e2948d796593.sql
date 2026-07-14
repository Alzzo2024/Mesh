
-- Resolve login identifier (email, @username/nickname, or #fixed_id) → email
CREATE OR REPLACE FUNCTION public.resolve_login_email(_identifier text)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ident text := trim(_identifier);
  target_user uuid;
  target_email text;
BEGIN
  IF ident IS NULL OR length(ident) = 0 THEN RETURN NULL; END IF;

  -- Fixed ID lookup (#ABC123 or just ABC123 all-caps alnum)
  IF left(ident, 1) = '#' THEN
    SELECT id INTO target_user FROM public.profiles
      WHERE fixed_id = upper(substring(ident from 2))
      LIMIT 1;
  -- Nickname lookup (@name)
  ELSIF left(ident, 1) = '@' THEN
    SELECT id INTO target_user FROM public.profiles
      WHERE lower(nickname) = lower(substring(ident from 2))
      LIMIT 1;
  -- Contains @ → assume email, return as-is
  ELSIF position('@' in ident) > 0 THEN
    RETURN lower(ident);
  ELSE
    -- Bare token: try fixed_id, then nickname
    SELECT id INTO target_user FROM public.profiles
      WHERE fixed_id = upper(ident)
      LIMIT 1;
    IF target_user IS NULL THEN
      SELECT id INTO target_user FROM public.profiles
        WHERE lower(nickname) = lower(ident)
        LIMIT 1;
    END IF;
  END IF;

  IF target_user IS NULL THEN RETURN NULL; END IF;

  SELECT email INTO target_email FROM auth.users WHERE id = target_user;
  RETURN target_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_login_email(text) TO anon, authenticated;
