/*
# Storage policies for motor-images bucket

## Overview
Sets up RLS policies for the `motor-images` storage bucket so:
- Public (anon) can READ images
- Authenticated (admin) can UPLOAD, UPDATE, DELETE images

## Security
- Public read access for motor images (they are displayed on the public website)
- Only authenticated users can upload/update/delete
*/

-- Public read access
DROP POLICY IF EXISTS "Public read motor images" ON storage.objects;
CREATE POLICY "Public read motor images" ON storage.objects FOR SELECT
  TO anon, authenticated USING (bucket_id = 'motor-images');

-- Authenticated can upload
DROP POLICY IF EXISTS "Auth upload motor images" ON storage.objects;
CREATE POLICY "Auth upload motor images" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'motor-images');

-- Authenticated can update
DROP POLICY IF EXISTS "Auth update motor images" ON storage.objects;
CREATE POLICY "Auth update motor images" ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'motor-images');

-- Authenticated can delete
DROP POLICY IF EXISTS "Auth delete motor images" ON storage.objects;
CREATE POLICY "Auth delete motor images" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'motor-images');
