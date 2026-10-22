-- Public storage bucket for guide cover images
INSERT INTO storage.buckets (id, name, public)
VALUES ('guide-covers', 'guide-covers', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public_read_guide_covers" ON storage.objects
  FOR SELECT USING (bucket_id = 'guide-covers');

CREATE POLICY "admin_upload_guide_covers" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'guide-covers' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
