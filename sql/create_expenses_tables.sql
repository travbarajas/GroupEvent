-- Create group expenses tables
-- Run this in Neon SQL editor

-- Main expenses table (similar to group_events)
CREATE TABLE group_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL,
  description TEXT NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  created_by_device_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Participants table (handles payers and owers)
CREATE TABLE expense_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES group_expenses(id) ON DELETE CASCADE,
  member_device_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('payer', 'ower')),
  individual_amount DECIMAL(10,2) NOT NULL,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'sent', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_group_expenses_group_id ON group_expenses(group_id);
CREATE INDEX idx_group_expenses_created_at ON group_expenses(created_at DESC);
CREATE INDEX idx_expense_participants_expense_id ON expense_participants(expense_id);
CREATE INDEX idx_expense_participants_device_id ON expense_participants(member_device_id);
CREATE INDEX idx_expense_participants_role ON expense_participants(role);
CREATE INDEX idx_expense_participants_status ON expense_participants(payment_status);

-- Optional: Add foreign key constraint to groups table if you want strict referential integrity
-- ALTER TABLE group_expenses ADD CONSTRAINT fk_group_expenses_group_id 
-- FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;

-- Create a function to automatically update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_group_expenses_updated_at 
    BEFORE UPDATE ON group_expenses 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expense_participants_updated_at 
    BEFORE UPDATE ON expense_participants 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();