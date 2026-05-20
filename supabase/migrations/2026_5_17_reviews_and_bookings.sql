-- 1. Discovery radius slider (Session 1)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS discovery_radius_miles integer;

-- 2. Restaurants can update their own slots
CREATE POLICY "restaurants_update_own_slots"
  ON availability FOR UPDATE
  USING (restaurant_id = auth.uid());

-- 3. Restaurants can update bookings they own
CREATE POLICY "restaurants_update_own_bookings"
  ON bookings FOR UPDATE
  USING (restaurant_id = auth.uid());

-- 4. Unique constraint on username
ALTER TABLE profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);

-- 5. Reviews table
CREATE TABLE reviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  reviewer_id uuid REFERENCES profiles(id),
  reviewee_id uuid REFERENCES profiles(id),
  booking_id uuid REFERENCES bookings(id),
  rating integer CHECK (rating >= 1 AND rating <= 5),
  review_text text,
  verified boolean DEFAULT false
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone logged in can read reviews"
  ON reviews FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can write reviews for their bookings"
  ON reviews FOR INSERT
  WITH CHECK (auth.uid() = reviewer_id);

CREATE POLICY "Users can update their own reviews"
  ON reviews FOR UPDATE
  USING (auth.uid() = reviewer_id);

-- 6. Authenticated users can read confirmed bookings (for public profile pages)
CREATE POLICY "Authenticated users can read confirmed bookings"
  ON bookings FOR SELECT
  USING (auth.role() = 'authenticated' AND status = 'confirmed');
