CREATE TABLE IF NOT EXISTS profile_views (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  viewer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  viewed_at timestamptz DEFAULT now(),
  CONSTRAINT profile_views_unique_viewer UNIQUE (profile_id, viewer_id)
);

ALTER TABLE profile_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record a view" ON profile_views
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Profile owners can read their views" ON profile_views
  FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY "Viewers can read their own views" ON profile_views
  FOR SELECT USING (viewer_id = auth.uid());

CREATE POLICY "Viewers can update their own views" ON profile_views
  FOR UPDATE USING (viewer_id = auth.uid());
