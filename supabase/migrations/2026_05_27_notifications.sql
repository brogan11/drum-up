CREATE TABLE IF NOT EXISTS notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Anyone can insert" ON notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users update own" ON notifications
  FOR UPDATE USING (user_id = auth.uid());
