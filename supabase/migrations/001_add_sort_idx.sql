-- Idempotent column + RPC used by supabase/seed.py (client.rpc('seed_add_player_slots_sort_idx')).
-- Equivalent to: ALTER TABLE player_slots ADD COLUMN sort_idx INTEGER;
ALTER TABLE player_slots ADD COLUMN IF NOT EXISTS sort_idx INTEGER;

CREATE OR REPLACE FUNCTION public.seed_add_player_slots_sort_idx()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  ALTER TABLE player_slots ADD COLUMN IF NOT EXISTS sort_idx INTEGER;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_add_player_slots_sort_idx() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_add_player_slots_sort_idx() TO service_role;
