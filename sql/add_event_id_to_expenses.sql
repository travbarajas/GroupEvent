-- Add event_id field to group_expenses table
-- Run this in Neon SQL editor to associate expenses with specific events

-- Add the event_id column (nullable initially for existing expenses)
ALTER TABLE group_expenses 
ADD COLUMN event_id TEXT;

-- Add index for better query performance
CREATE INDEX idx_group_expenses_event_id ON group_expenses(event_id);

-- Optional: Add foreign key constraint if you want strict referential integrity
-- Note: This assumes your events table is named 'group_events' with TEXT id field
-- ALTER TABLE group_expenses ADD CONSTRAINT fk_group_expenses_event_id 
-- FOREIGN KEY (event_id) REFERENCES group_events(id) ON DELETE CASCADE;