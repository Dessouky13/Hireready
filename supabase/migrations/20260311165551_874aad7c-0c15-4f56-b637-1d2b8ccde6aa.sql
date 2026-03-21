-- Update default credits from 3 to 1 for new users
ALTER TABLE public.credits ALTER COLUMN balance SET DEFAULT 1;

-- Update the handle_new_user function to give 1 credit instead of 3
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'avatar_url');
  INSERT INTO public.credits (user_id, balance)
  VALUES (NEW.id, 1);
  RETURN NEW;
END;
$function$;