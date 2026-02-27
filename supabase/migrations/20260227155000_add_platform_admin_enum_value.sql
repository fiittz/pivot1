-- Add 'platform_admin' to user_role_type enum
-- Must be in its own migration (separate transaction) before it can be used
ALTER TYPE public.user_role_type ADD VALUE IF NOT EXISTS 'platform_admin';
