const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = neon(process.env.DATABASE_URL);

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Ensure notifications table exists
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'draft',
        scheduled_for TIMESTAMP WITH TIME ZONE NULL,
        sent_at TIMESTAMP WITH TIME ZONE NULL,
        created_by_device_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
  } catch (error) {
    console.log('Table may already exist:', error.message);
  }

  if (req.method === 'GET') {
    try {
      const notifications = await sql`
        SELECT
          id,
          title,
          body,
          status,
          scheduled_for,
          sent_at,
          created_by_device_id,
          created_at,
          updated_at
        FROM notifications
        ORDER BY created_at DESC
      `;

      return res.status(200).json({ notifications });
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { device_id, title, body, scheduled_for } = req.body;

      if (!device_id) {
        return res.status(400).json({ error: 'device_id is required' });
      }

      if (!title || !title.trim()) {
        return res.status(400).json({ error: 'title is required' });
      }

      if (!body || !body.trim()) {
        return res.status(400).json({ error: 'body is required' });
      }

      const status = scheduled_for ? 'scheduled' : 'draft';

      const [notification] = await sql`
        INSERT INTO notifications (
          title,
          body,
          status,
          scheduled_for,
          created_by_device_id
        )
        VALUES (
          ${title.trim()},
          ${body.trim()},
          ${status},
          ${scheduled_for || null},
          ${device_id}
        )
        RETURNING *
      `;

      return res.status(201).json(notification);
    } catch (error) {
      console.error('Error creating notification:', error);
      return res.status(500).json({ error: 'Failed to create notification', details: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
