-- Add backup_email column for account recovery
-- Users can set this as a secondary email to receive password reset links
-- No uniqueness constraint: two users may share a backup email
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS backup_email TEXT;
