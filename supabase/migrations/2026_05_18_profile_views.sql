CREATE TABLE profile_views (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  viewer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  viewed_at timestamptz DEFAULT now()
);

ALTER TABLE profile_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record a view" ON profile_views
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Profile owners can read their views" ON profile_views
  FOR SELECT USING (profile_id = auth.uid());
