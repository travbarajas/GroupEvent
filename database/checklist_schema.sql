-- Checklist Items Table
-- Stores individual checklist items for events
CREATE TABLE IF NOT EXISTS checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL, -- References the event this checklist belongs to
  group_id text NOT NULL, -- References the group for easier querying
  item_name text NOT NULL,
  people_needed integer DEFAULT 1,
  added_by text NOT NULL, -- device_id of the user who added this item
  completed boolean DEFAULT false,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  
  -- Index for faster queries
  INDEX idx_checklist_items_event_id (event_id),
  INDEX idx_checklist_items_group_id (group_id),
  INDEX idx_checklist_items_added_by (added_by)
);

-- Checklist Assignments Table
-- Tracks which users are assigned to which checklist items
CREATE TABLE IF NOT EXISTS checklist_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_item_id uuid REFERENCES checklist_items(id) ON DELETE CASCADE,
  assigned_to text NOT NULL, -- device_id of the assigned user
  completed_by_user boolean DEFAULT false,
  assigned_at timestamp DEFAULT now(),
  completed_at timestamp NULL,
  
  -- Ensure unique assignment per user per item
  UNIQUE(checklist_item_id, assigned_to),
  
  -- Index for faster queries
  INDEX idx_checklist_assignments_item_id (checklist_item_id),
  INDEX idx_checklist_assignments_assigned_to (assigned_to)
);

-- GPT Generated Checklists Table (for future use)
-- Stores GPT-generated checklist templates for different event types
CREATE TABLE IF NOT EXISTS checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL, -- 'beach', 'dinner', 'party', etc.
  event_keywords text[], -- Keywords that trigger this template
  template_name text NOT NULL,
  checklist_items jsonb NOT NULL, -- Array of {item_name, people_needed}
  gpt_prompt text, -- The prompt used to generate this template
  created_at timestamp DEFAULT now(),
  usage_count integer DEFAULT 0,
  
  -- Index for faster template matching
  INDEX idx_checklist_templates_event_type (event_type),
  INDEX idx_checklist_templates_keywords (event_keywords)
);

-- Checklist Item Activity Log (for analytics/debugging)
CREATE TABLE IF NOT EXISTS checklist_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_item_id uuid REFERENCES checklist_items(id) ON DELETE CASCADE,
  user_device_id text NOT NULL,
  action text NOT NULL, -- 'created', 'assigned', 'completed', 'deleted'
  metadata jsonb, -- Additional context about the action
  timestamp timestamp DEFAULT now(),
  
  -- Index for activity tracking
  INDEX idx_checklist_activity_item_id (checklist_item_id),
  INDEX idx_checklist_activity_user (user_device_id),
  INDEX idx_checklist_activity_timestamp (timestamp)
);

-- Views for easier querying

-- View: Checklist items with assignment counts
CREATE OR REPLACE VIEW checklist_items_with_stats AS
SELECT 
  ci.*,
  COALESCE(assignment_stats.assigned_count, 0) as assigned_count,
  COALESCE(assignment_stats.completed_count, 0) as completed_count,
  CASE 
    WHEN COALESCE(assignment_stats.assigned_count, 0) >= ci.people_needed 
    THEN true 
    ELSE false 
  END as fully_assigned,
  CASE 
    WHEN COALESCE(assignment_stats.completed_count, 0) >= ci.people_needed 
    THEN true 
    ELSE false 
  END as fully_completed
FROM checklist_items ci
LEFT JOIN (
  SELECT 
    checklist_item_id,
    COUNT(*) as assigned_count,
    COUNT(CASE WHEN completed_by_user THEN 1 END) as completed_count
  FROM checklist_assignments
  GROUP BY checklist_item_id
) assignment_stats ON ci.id = assignment_stats.checklist_item_id;

-- View: Event checklist progress
CREATE OR REPLACE VIEW event_checklist_progress AS
SELECT 
  event_id,
  group_id,
  COUNT(*) as total_items,
  COUNT(CASE WHEN fully_assigned THEN 1 END) as assigned_items,
  COUNT(CASE WHEN fully_completed THEN 1 END) as completed_items,
  ROUND(
    COUNT(CASE WHEN fully_completed THEN 1 END) * 100.0 / COUNT(*), 
    2
  ) as completion_percentage
FROM checklist_items_with_stats
GROUP BY event_id, group_id;

-- Functions for common operations

-- Function: Get checklist for an event with assignments
CREATE OR REPLACE FUNCTION get_event_checklist(p_event_id text)
RETURNS TABLE (
  item_id uuid,
  item_name text,
  people_needed integer,
  added_by text,
  completed boolean,
  created_at timestamp,
  assigned_members jsonb,
  assignment_count integer,
  completion_count integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ci.id,
    ci.item_name,
    ci.people_needed,
    ci.added_by,
    ci.completed,
    ci.created_at,
    COALESCE(
      json_agg(
        json_build_object(
          'device_id', ca.assigned_to,
          'completed', ca.completed_by_user,
          'assigned_at', ca.assigned_at,
          'completed_at', ca.completed_at
        )
      ) FILTER (WHERE ca.assigned_to IS NOT NULL),
      '[]'::json
    )::jsonb as assigned_members,
    COALESCE(COUNT(ca.assigned_to), 0)::integer as assignment_count,
    COALESCE(COUNT(ca.assigned_to) FILTER (WHERE ca.completed_by_user), 0)::integer as completion_count
  FROM checklist_items ci
  LEFT JOIN checklist_assignments ca ON ci.id = ca.checklist_item_id
  WHERE ci.event_id = p_event_id
  GROUP BY ci.id, ci.item_name, ci.people_needed, ci.added_by, ci.completed, ci.created_at
  ORDER BY ci.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Function: Auto-assign users to checklist items (for GPT integration)
CREATE OR REPLACE FUNCTION auto_assign_checklist_items(
  p_event_id text,
  p_assignment_strategy text DEFAULT 'balanced' -- 'balanced', 'random', 'skill_based'
)
RETURNS TABLE (
  item_id uuid,
  assigned_users text[]
) AS $$
DECLARE
  available_users text[];
  item_record record;
  assignments_made integer;
BEGIN
  -- Get all group members for this event (simplified - would need actual group membership)
  -- This is a placeholder for the actual logic
  available_users := ARRAY['user1', 'user2', 'user3']; -- Replace with actual query
  
  FOR item_record IN 
    SELECT id, people_needed 
    FROM checklist_items 
    WHERE event_id = p_event_id 
    AND id NOT IN (
      SELECT DISTINCT checklist_item_id 
      FROM checklist_assignments
    )
  LOOP
    -- Simple balanced assignment (could be enhanced with actual algorithm)
    -- This is where GPT could suggest optimal assignments based on user skills/preferences
    
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql;