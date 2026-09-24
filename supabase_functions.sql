-- ============================================================
-- Add these functions to your Supabase SQL editor
-- They are called from the Node.js backend to safely
-- increment usage counters without race conditions
-- ============================================================

-- Increment recipe generation count
create or replace function public.increment_recipe_gen(user_id uuid)
returns void as $$
  update public.profiles
  set
    recipe_gens_this_month = recipe_gens_this_month + 1,
    updated_at = now()
  where id = user_id;
$$ language sql security definer;

-- Increment AI question count
create or replace function public.increment_ai_question(user_id uuid)
returns void as $$
  update public.profiles
  set
    ai_questions_this_month = ai_questions_this_month + 1,
    updated_at = now()
  where id = user_id;
$$ language sql security definer;

-- Reset monthly usage (run via pg_cron on the 1st of each month)
create or replace function public.reset_monthly_usage()
returns void as $$
  update public.profiles
  set
    recipe_gens_this_month = 0,
    ai_questions_this_month = 0,
    updated_at = now();
$$ language sql security definer;

-- Schedule the reset using pg_cron (enable pg_cron extension first)
-- select cron.schedule('reset-monthly-usage', '0 0 1 * *', 'select public.reset_monthly_usage()');
