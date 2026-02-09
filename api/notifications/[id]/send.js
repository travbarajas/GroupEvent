const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = neon(process.env.DATABASE_URL);

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Notification ID is required' });
  }

  try {
    // Check if notification exists and is not already sent
    const [existing] = await sql`
      SELECT * FROM notifications WHERE id = ${id}
    `;

    if (!existing) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (existing.status === 'sent') {
      return res.status(400).json({ error: 'Notification has already been sent' });
    }

    // Update notification status to sent
    const [notification] = await sql`
      UPDATE notifications SET
        status = 'sent',
        sent_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    // TODO: Integrate with actual push notification service (Expo Push, Firebase, etc.)
    // For now, we just mark it as sent in the database
    console.log('📱 Push notification would be sent:', {
      title: notification.title,
      body: notification.body,
      sentAt: notification.sent_at
    });

    return res.status(200).json({
      message: 'Notification sent successfully',
      notification
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    return res.status(500).json({ error: 'Failed to send notification', details: error.message });
  }
};
