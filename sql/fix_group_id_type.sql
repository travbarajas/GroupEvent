-- Fix group_id type mismatch in expense tables
-- Run this in Neon SQL editor to change UUID to TEXT to match existing groups table

-- First, drop the foreign key constraints if they exist
ALTER TABLE expense_participants DROP CONSTRAINT IF EXISTS expense_participants_expense_id_fkey;

-- Change group_id from UUID to TEXT in group_expenses table
ALTER TABLE group_expenses ALTER COLUMN group_id TYPE TEXT;

-- Re-add the foreign key constraint for expense_participants
ALTER TABLE expense_participants ADD CONSTRAINT expense_participants_expense_id_fkey 
FOREIGN KEY (expense_id) REFERENCES group_expenses(id) ON DELETE CASCADE;