/*
# Fix trigger search_path and bootstrap admin user

## Problem
The `handle_new_user()` trigger function is `SECURITY DEFINER` but does not
have `SET search_path`, which can cause it to fail when resolving the
`profiles` table. This failure propagates back to `admin.createUser` as
"Database error creating new user".

Additionally, there are currently zero users in the database, so no admin
exists to log in and create other users through the admin panel.

## Changes
1. Replaces `handle_new_user()` with a version that has `SET search_path = public`.
2. Creates the first admin user in `auth.users` with a known password.
3. Creates the corresponding admin profile row.
4. The admin can then log in and create sales/other admin accounts from the UI.

## Credentials
- Email: admin@hondapantura.com
- Password: Admin123! (should be changed after first login)
*/

-- Fix the trigger function with proper search_path
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If a profile with this email exists but belongs to a different user,
  -- clear the old email so the new profile can use it
  UPDATE profiles SET email = NULL
  WHERE email = NEW.email AND id <> NEW.id;

  -- Insert or update the profile
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
    full_name = EXCLUDED.full_name;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Bootstrap the first admin user
-- Check if admin user already exists
DO $$
DECLARE
  admin_id uuid;
BEGIN
  -- Try to find existing user with this email
  SELECT id INTO admin_id FROM auth.users WHERE email = 'admin@hondapantura.com';

  IF admin_id IS NULL THEN
    -- Create new admin user
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_user_meta_data,
      raw_app_meta_data
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'admin@hondapantura.com',
      crypt('Admin123!', gen_salt('bf')),
      now(),
      now(),
      now(),
      jsonb_build_object('full_name', 'Administrator'),
      jsonb_build_object()
    )
    RETURNING id INTO admin_id;
  END IF;

  -- Upsert the admin profile
  INSERT INTO profiles (id, email, full_name, role, status)
  VALUES (admin_id, 'admin@hondapantura.com', 'Administrator', 'admin', 'active')
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = 'admin',
    status = 'active';
END $$;
