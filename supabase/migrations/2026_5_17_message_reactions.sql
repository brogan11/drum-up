-- Message Reactions Table

CREATE TABLE message_reactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  message_id uuid REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id),
  emoji text NOT NULL,
  UNIQUE(message_id, user_id, emoji)
);

ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can add reactions"
ON message_reactions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can see reactions"
ON message_reactions FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Users can remove their own reactions"
ON message_reactions FOR DELETE
USING (auth.uid() = user_id);