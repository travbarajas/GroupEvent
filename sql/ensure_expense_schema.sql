-- Ensure expense schema is correct with all required columns
-- Run this in Neon SQL editor to make sure all columns exist
-- Run each section separately if needed

-- Create group_expenses table if it doesn't exist
CREATE TABLE IF NOT EXISTS group_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id TEXT NOT NULL,
    description TEXT NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    created_by_device_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    event_id TEXT
);

-- Create expense_participants table if it doesn't exist
CREATE TABLE IF NOT EXISTS expense_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_id UUID NOT NULL,
    member_device_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('payer', 'ower')),
    individual_amount DECIMAL(10,2) NOT NULL,
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'sent', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraint if it doesn't exist
ALTER TABLE expense_participants 
DROP CONSTRAINT IF EXISTS expense_participants_expense_id_fkey;

ALTER TABLE expense_participants 
ADD CONSTRAINT expense_participants_expense_id_fkey 
FOREIGN KEY (expense_id) REFERENCES group_expenses(id) ON DELETE CASCADE;

-- Ensure event_id column exists (safe to run multiple times)
ALTER TABLE group_expenses ADD COLUMN IF NOT EXISTS event_id TEXT;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_group_expenses_group_id ON group_expenses(group_id);
CREATE INDEX IF NOT EXISTS idx_group_expenses_event_id ON group_expenses(event_id);
CREATE INDEX IF NOT EXISTS idx_group_expenses_created_at ON group_expenses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expense_participants_expense_id ON expense_participants(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_participants_device_id ON expense_participants(member_device_id);
CREATE INDEX IF NOT EXISTS idx_expense_participants_role ON expense_participants(role);
CREATE INDEX IF NOT EXISTS idx_expense_participants_status ON expense_participants(payment_status);

-- Show final table structure
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name IN ('group_expenses', 'expense_participants')
ORDER BY table_name, ordinal_position;