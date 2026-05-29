-- Retention features: saved bookmarks + gig-alert preference

-- 1. Saved items — personal bookmark list (gigs, venues, musicians)
CREATE TABLE IF NOT EXISTS saved_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('gig', 'venue', 'musician')),
  item_id uuid NOT NULL,
  UNIQUE (user_id, item_type, item_id)
);

ALTER TABLE saved_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own saved" ON saved_items
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 2. Gig-alert opt-out (default on)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notify_gig_alerts boolean DEFAULT true;
