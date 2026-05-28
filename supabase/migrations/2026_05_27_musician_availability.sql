CREATE TABLE IF NOT EXISTS musician_availability (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  musician_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  date date NOT NULL,
  start_time time,
  end_time time,
  genres text[],
  min_pay numeric,
  notes text,
  status text DEFAULT 'open',
  latitude numeric,
  longitude numeric,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE musician_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Musician can manage own" ON musician_availability
  FOR ALL USING (musician_id = auth.uid());

CREATE POLICY "Restaurants can read open" ON musician_availability
  FOR SELECT USING (status = 'open');
