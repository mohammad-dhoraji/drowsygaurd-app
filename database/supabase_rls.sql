-- DrowsyGuard Supabase hardening migration
-- Run this in the Supabase SQL editor for project: owcstslgzqkymlivnqhg

DO $$
BEGIN
  CREATE TYPE user_role AS ENUM ('driver', 'guardian');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE alert_severity AS ENUM ('LOW', 'MEDIUM', 'HIGH');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  role user_role,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS driver_guardians (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  driver_id UUID REFERENCES profiles(id),
  guardian_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID REFERENCES profiles(id),
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  status TEXT DEFAULT 'ACTIVE'
);

CREATE TABLE IF NOT EXISTS drowsiness_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id UUID REFERENCES sessions(id),
  driver_id UUID REFERENCES profiles(id),
  ear_value FLOAT,
  duration_seconds FLOAT,
  severity alert_severity,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guardian_notifications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  driver_id UUID REFERENCES profiles(id),
  guardian_id UUID REFERENCES profiles(id),
  session_id UUID REFERENCES sessions(id),
  message TEXT,
  severity alert_severity,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_guardians_guardian_id ON driver_guardians (guardian_id);
CREATE INDEX IF NOT EXISTS idx_driver_guardians_driver_id ON driver_guardians (driver_id);
CREATE INDEX IF NOT EXISTS idx_sessions_driver_id_status ON sessions (driver_id, status);
CREATE INDEX IF NOT EXISTS idx_events_driver_id_created_at ON drowsiness_events (driver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_guardian_id_created_at ON guardian_notifications (guardian_id, created_at DESC);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE drowsiness_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardian_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Guardians can view their drivers" ON profiles;
CREATE POLICY "Guardians can view their drivers"
ON profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM driver_guardians
    WHERE driver_guardians.guardian_id = auth.uid()
      AND driver_guardians.driver_id = profiles.id
  )
);

DROP POLICY IF EXISTS "Users view own mapping" ON driver_guardians;
CREATE POLICY "Users view own mapping"
ON driver_guardians FOR SELECT
USING (guardian_id = auth.uid() OR driver_id = auth.uid());

DROP POLICY IF EXISTS "Drivers manage own sessions" ON sessions;
CREATE POLICY "Drivers manage own sessions"
ON sessions FOR ALL
USING (driver_id = auth.uid())
WITH CHECK (driver_id = auth.uid());

DROP POLICY IF EXISTS "Guardians view drivers sessions" ON sessions;
CREATE POLICY "Guardians view drivers sessions"
ON sessions FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM driver_guardians
    WHERE driver_guardians.guardian_id = auth.uid()
      AND driver_guardians.driver_id = sessions.driver_id
  )
);

DROP POLICY IF EXISTS "Drivers insert events" ON drowsiness_events;
CREATE POLICY "Drivers insert events"
ON drowsiness_events FOR INSERT
WITH CHECK (driver_id = auth.uid());

DROP POLICY IF EXISTS "Drivers view own events" ON drowsiness_events;
CREATE POLICY "Drivers view own events"
ON drowsiness_events FOR SELECT
USING (driver_id = auth.uid());

DROP POLICY IF EXISTS "Guardians view events" ON drowsiness_events;
CREATE POLICY "Guardians view events"
ON drowsiness_events FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM driver_guardians
    WHERE driver_guardians.guardian_id = auth.uid()
      AND driver_guardians.driver_id = drowsiness_events.driver_id
  )
);

DROP POLICY IF EXISTS "Drivers create notifications" ON guardian_notifications;
CREATE POLICY "Drivers create notifications"
ON guardian_notifications FOR INSERT
WITH CHECK (driver_id = auth.uid());

DROP POLICY IF EXISTS "Guardians view own notifications" ON guardian_notifications;
CREATE POLICY "Guardians view own notifications"
ON guardian_notifications FOR SELECT
USING (guardian_id = auth.uid());

DROP POLICY IF EXISTS "Guardians mark notifications read" ON guardian_notifications;
CREATE POLICY "Guardians mark notifications read"
ON guardian_notifications FOR UPDATE
USING (guardian_id = auth.uid())
WITH CHECK (guardian_id = auth.uid());
