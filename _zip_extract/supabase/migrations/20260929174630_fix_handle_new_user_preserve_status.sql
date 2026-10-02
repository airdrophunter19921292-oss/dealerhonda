-- Fix: handle_new_user trigger should not override status on conflict
-- When the edge function creates a user and then updates the profile to active,
-- the trigger was resetting it back to inactive on conflict.
-- Now the trigger only sets status='inactive' on INSERT (new user), not on UPDATE.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
-- If a profile with this email exists but belongs to a different user,
-- clear the old email so the new profile can use it
UPDATE profiles SET email = NULL
WHERE email = NEW.email AND id <> NEW.id;

-- Insert or update the profile
-- On conflict (existing profile), preserve the existing status
-- so the edge function's update to 'active' is not overridden
INSERT INTO profiles (id, email, full_name, role, status)
VALUES (
  NEW.id,
  NEW.email,
  COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
  'sales',
  'inactive'
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), profiles.full_name);

RETURN NEW;
END;
$$;
