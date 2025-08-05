const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = neon(process.env.DATABASE_URL);

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const { id: groupId, eventId } = req.query;
  
  if (req.method === 'GET') {
    try {
      const { device_id } = req.query;
      
      if (!device_id) {
        return res.status(400).json({ error: 'device_id is required' });
      }

      // Check if user is a member of this group
      const [membership] = await sql`
        SELECT 1 FROM members WHERE group_id = ${groupId} AND device_id = ${device_id}
      `;

      if (!membership) {
        return res.status(403).json({ error: 'You are not a member of this group' });
      }

      // Get checklist items with assignments
      const checklistItems = await sql`
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
                'assigned_at', ca.assigned_at
              )
            ) FILTER (WHERE ca.assigned_to IS NOT NULL),
            '[]'::json
          ) as assigned_members
        FROM checklist_items ci
        LEFT JOIN checklist_assignments ca ON ci.id = ca.checklist_item_id
        WHERE ci.event_id = ${eventId} AND ci.group_id = ${groupId}
        GROUP BY ci.id, ci.item_name, ci.people_needed, ci.added_by, ci.completed, ci.created_at
        ORDER BY ci.created_at ASC
      `;
      
      return res.status(200).json({ checklistItems });
    } catch (error) {
      console.error('Error fetching checklist:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { device_id, item_name, people_needed = 1 } = req.body;
      
      if (!device_id) {
        return res.status(400).json({ error: 'device_id is required' });
      }

      if (!item_name || !item_name.trim()) {
        return res.status(400).json({ error: 'item_name is required' });
      }

      // Check if user is a member of this group
      const [membership] = await sql`
        SELECT 1 FROM members WHERE group_id = ${groupId} AND device_id = ${device_id}
      `;

      if (!membership) {
        return res.status(403).json({ error: 'You are not a member of this group' });
      }

      // Create the checklist item
      const [newItem] = await sql`
        INSERT INTO checklist_items (event_id, group_id, item_name, people_needed, added_by)
        VALUES (${eventId}, ${groupId}, ${item_name.trim()}, ${people_needed}, ${device_id})
        RETURNING *
      `;
      
      return res.status(201).json({ success: true, item: newItem });

    } catch (error) {
      console.error('Error creating checklist item:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { device_id, item_id, action, assigned_members } = req.body;
      
      if (!device_id) {
        return res.status(400).json({ error: 'device_id is required' });
      }

      if (!item_id) {
        return res.status(400).json({ error: 'item_id is required' });
      }

      // Check if user is a member of this group
      const [membership] = await sql`
        SELECT 1 FROM members WHERE group_id = ${groupId} AND device_id = ${device_id}
      `;

      if (!membership) {
        return res.status(403).json({ error: 'You are not a member of this group' });
      }

      if (action === 'toggle_completion') {
        // Toggle completion status for the item
        const [updatedItem] = await sql`
          UPDATE checklist_items 
          SET completed = NOT completed, updated_at = now()
          WHERE id = ${item_id} AND event_id = ${eventId} AND group_id = ${groupId}
          RETURNING *
        `;

        if (!updatedItem) {
          return res.status(404).json({ error: 'Checklist item not found' });
        }

        return res.status(200).json({ success: true, item: updatedItem });
      }

      if (action === 'update_assignments') {
        if (!Array.isArray(assigned_members)) {
          return res.status(400).json({ error: 'assigned_members must be an array' });
        }

        // Remove existing assignments for this item
        await sql`
          DELETE FROM checklist_assignments 
          WHERE checklist_item_id = ${item_id}
        `;

        // Add new assignments
        if (assigned_members.length > 0) {
          const assignments = assigned_members.map(deviceId => ({
            checklist_item_id: item_id,
            assigned_to: deviceId
          }));

          await sql`
            INSERT INTO checklist_assignments (checklist_item_id, assigned_to)
            SELECT * FROM ${sql(assignments)}
          `;
        }

        return res.status(200).json({ success: true });
      }

      if (action === 'toggle_user_completion') {
        // Toggle completion status for a specific user assignment
        const [assignment] = await sql`
          SELECT * FROM checklist_assignments 
          WHERE checklist_item_id = ${item_id} AND assigned_to = ${device_id}
        `;

        if (!assignment) {
          return res.status(404).json({ error: 'Assignment not found' });
        }

        const [updatedAssignment] = await sql`
          UPDATE checklist_assignments 
          SET 
            completed_by_user = NOT completed_by_user,
            completed_at = CASE 
              WHEN completed_by_user THEN NULL 
              ELSE now() 
            END
          WHERE checklist_item_id = ${item_id} AND assigned_to = ${device_id}
          RETURNING *
        `;

        return res.status(200).json({ success: true, assignment: updatedAssignment });
      }

      return res.status(400).json({ error: 'Invalid action' });

    } catch (error) {
      console.error('Error updating checklist item:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { device_id, item_id } = req.body;
      
      if (!device_id) {
        return res.status(400).json({ error: 'device_id is required' });
      }

      if (!item_id) {
        return res.status(400).json({ error: 'item_id is required' });
      }

      // Check if user is a member of this group
      const [membership] = await sql`
        SELECT 1 FROM members WHERE group_id = ${groupId} AND device_id = ${device_id}
      `;

      if (!membership) {
        return res.status(403).json({ error: 'You are not a member of this group' });
      }

      // Check if the item exists and if user can delete it
      const [item] = await sql`
        SELECT * FROM checklist_items 
        WHERE id = ${item_id} AND event_id = ${eventId} AND group_id = ${groupId}
      `;

      if (!item) {
        return res.status(404).json({ error: 'Checklist item not found' });
      }

      // Only the creator can delete the item
      if (item.added_by !== device_id) {
        return res.status(403).json({ error: 'Only the creator can delete this item' });
      }

      // Delete assignments first (CASCADE should handle this, but being explicit)
      await sql`
        DELETE FROM checklist_assignments WHERE checklist_item_id = ${item_id}
      `;

      // Delete the item
      await sql`
        DELETE FROM checklist_items WHERE id = ${item_id}
      `;
      
      return res.status(200).json({ success: true });

    } catch (error) {
      console.error('Error deleting checklist item:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};