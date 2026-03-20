-- Add 2FA related columns to users table
-- This migration adds the necessary fields for proper 2FA state management

-- Add the main 2FA requirement flag
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS requires_2fa BOOLEAN DEFAULT FALSE;

-- Add setup tracking fields
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS two_factor_setup_in_progress BOOLEAN DEFAULT FALSE;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS two_factor_setup_started_at TIMESTAMP NULL;

-- Create an index on the setup in progress flag for efficient cleanup queries
CREATE INDEX IF NOT EXISTS idx_users_two_factor_setup_in_progress 
ON users(two_factor_setup_in_progress) 
WHERE two_factor_setup_in_progress = TRUE;

-- Create an index on the setup started time for efficient expiration queries
CREATE INDEX IF NOT EXISTS idx_users_two_factor_setup_started_at 
ON users(two_factor_setup_started_at) 
WHERE two_factor_setup_started_at IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN users.requires_2fa IS 'Whether the user is required to use 2FA for login';
COMMENT ON COLUMN users.two_factor_setup_in_progress IS 'Whether the user is currently in the middle of setting up 2FA';
COMMENT ON COLUMN users.two_factor_setup_started_at IS 'Timestamp when 2FA setup was started (for expiration tracking)';
