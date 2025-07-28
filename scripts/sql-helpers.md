# SQL Query Helpers

## Find all events for a specific group ID

```sql
-- Find all events in a group
SELECT 
  id,
  name,
  description,
  date,
  time,
  location,
  custom_name,
  added_by_username,
  added_at,
  source_type
FROM group_events 
WHERE group_id = 'YOUR_GROUP_ID_HERE'
ORDER BY added_at DESC;

-- Example for your test group:
SELECT 
  id,
  name,
  description,
  date,
  time,
  location,
  custom_name,
  added_by_username,
  added_at,
  source_type
FROM group_events 
WHERE group_id = 'group_1753430044079_sawkauvlaw'
ORDER BY added_at DESC;
```

## Count events by group

```sql
-- Count events per group
SELECT 
  group_id,
  COUNT(*) as event_count
FROM group_events 
GROUP BY group_id
ORDER BY event_count DESC;
```

## Find events by creator

```sql
-- Find all events created by a specific device ID
SELECT 
  ge.*,
  g.name as group_name
FROM group_events ge
JOIN groups g ON ge.group_id = g.id
WHERE ge.added_by_device_id = 'YOUR_DEVICE_ID_HERE'
ORDER BY ge.added_at DESC;
```

## Delete test/bad data

```sql
-- Delete all events from a specific group (USE WITH CAUTION!)
DELETE FROM group_events 
WHERE group_id = 'YOUR_GROUP_ID_HERE';

-- Delete events with missing required fields
DELETE FROM group_events 
WHERE name IS NULL OR name = '';
```

## Verify deletion

```sql
-- Check if events were deleted
SELECT COUNT(*) as remaining_events
FROM group_events 
WHERE group_id = 'YOUR_GROUP_ID_HERE';
```