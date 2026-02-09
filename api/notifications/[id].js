const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = neon(process.env.DATABASE_URL);

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Notification ID is required' });
  }

  if (req.method === 'GET') {
    try {
      const [notification] = await sql`
        SELECT * FROM notifications WHERE id = ${id}
      `;

      if (!notification) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      return res.status(200).json(notification);
    } catch (error) {
      console.error('Error fetching notification:', error);
      return res.status(500).json({ error: 'Failed to fetch notification' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { title, body, scheduled_for, status } = req.body;

      // Check if notification exists
      const [existing] = await sql`
        SELECT * FROM notifications WHERE id = ${id}
      `;

      if (!existing) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      // Don't allow editing sent notifications
      if (existing.status === 'sent') {
        return res.status(400).json({ error: 'Cannot edit a sent notification' });
      }

      // Determine new status
      let newStatus = existing.status;
      if (status) {
        newStatus = status;
      } else if (scheduled_for) {
        newStatus = 'scheduled';
      }

      const [notification] = await sql`
        UPDATE notifications SET
          title = COALESCE(${title || null}, title),
          body = COALESCE(${body || null}, body),
          scheduled_for = ${scheduled_for || existing.scheduled_for},
          status = ${newStatus},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `;

      return res.status(200).json(notification);
    } catch (error) {
      console.error('Error updating notification:', error);
      return res.status(500).json({ error: 'Failed to update notification', details: error.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const [notification] = await sql`
        DELETE FROM notifications WHERE id = ${id}
        RETURNING *
      `;

      if (!notification) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      return res.status(200).json({ message: 'Notification deleted', notification });
    } catch (error) {
      console.error('Error deleting notification:', error);
      return res.status(500).json({ error: 'Failed to delete notification' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
