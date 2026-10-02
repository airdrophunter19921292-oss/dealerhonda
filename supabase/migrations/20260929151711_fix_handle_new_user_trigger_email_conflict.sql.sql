/*
# Fix handle_new_user trigger — email unique constraint conflict

## Problem
The `handle_new_user()` trigger fires after a new auth user is created via
`admin.createUser`. It inserts a row into `profiles` with the user's email.
The `profiles` table has a UNIQUE constraint on `email`. If a profile row
with the same email already exists (from a previous failed attempt, a
manually inserted row, or any other source), the INSERT fails with a
unique violation, which causes the entire `admin.createUser` call to fail
with "Database error creating new user".

## Fix
Update the trigger function to use `ON CONFLICT (id) DO UPDATE` so that
if a profile row already exists for this user ID, it updates the email
instead of doing nothing. Also handle the case where the email conflicts
with a different row by clearing the old row's email first.

## Changes
1. Replaces `handle_new_user()` function with a version that handles conflicts.
2. The function now:
   - Tries to insert the new profile.
   - On ID conflict, updates the existing row's fields.
   - On email conflict with a different user, clears the old email first.
*/

-- First, drop the old function and trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Create the improved function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- If a profile with this email exists but belongs to a different user,
  -- clear the email so the new profile can use it
  UPDATE profiles SET email = NULL
  WHERE email = NEW.email AND id <> NEW.id;

  -- Insert or update the profile
  INSERT INTO profiles (id, email, full_name, role, status)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), 'sales', 'inactive')
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
