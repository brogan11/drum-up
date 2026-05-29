-- Throttle "new message" emails: track the last time we emailed a user about
-- unread messages so we send at most one nudge per cooldown window, and only
-- after they've been inactive. In-app message notifications are unaffected.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_message_email_at timestamptz;
