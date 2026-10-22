-- =============================================
-- BairePorbo Migration: 011_repair_signup_trigger
--
-- Fix "Database error saving new user" on sign-up.
-- We only need to replace the trigger FUNCTION — the trigger binding
-- already points to handle_new_user, so the next sign-up will
-- automatically use the updated function.
--
-- Note: ALTER TABLE auth.users DISABLE TRIGGER is intentionally
-- omitted — the Supabase SQL editor cannot modify auth.users ownership.
-- =============================================

-- Ensure user_tasks table exists (idempotent)
CREATE TABLE IF NOT EXISTS user_tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  due_date    TEXT,
  status      TEXT NOT NULL DEFAULT 'Planned'
              CHECK (status IN ('Now', 'Soon', 'Planned', 'Done')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tasks_user_all" ON public.user_tasks;
CREATE POLICY "tasks_user_all" ON public.user_tasks
  FOR ALL USING (auth.uid() = user_id);

-- Ensure user_bookmarks table exists (idempotent)
CREATE TABLE IF NOT EXISTS user_bookmarks (
  user_id         UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  scholarship_id  UUID REFERENCES public.scholarships(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, scholarship_id)
);

ALTER TABLE public.user_bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bookmarks_user_all" ON public.user_bookmarks;
CREATE POLICY "bookmarks_user_all" ON public.user_bookmarks
  FOR ALL USING (auth.uid() = user_id);

-- Replace handle_new_user with a bulletproof SECURITY DEFINER version.
-- The existing trigger on auth.users already calls this function,
-- so replacing the function body is all that is needed.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert the profile row — this MUST succeed or auth fails
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;

  -- Seed default tasks — wrapped in its own block so any failure
  -- (missing table, constraint error, etc.) is non-fatal for auth
  BEGIN
    INSERT INTO public.user_tasks (user_id, title, due_date, status)
    VALUES
      (NEW.id, 'Complete your profile details',     'Today',     'Now'),
      (NEW.id, 'Run AI Match to find scholarships', 'Soon',      'Soon'),
      (NEW.id, 'Bookmark your top 3 choices',       'Next week', 'Planned');
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user task seed failed for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;
