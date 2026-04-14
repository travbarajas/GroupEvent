const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = neon(process.env.DATABASE_URL);

module.exports = async function handler(req, res) {
  const _origin = req.headers.origin || '';
  res.setHeader('Access-Control-Allow-Origin', (_origin === 'https://group-event.vercel.app' || _origin.endsWith('.exp.direct') || _origin === 'http://localhost:8081' || _origin === 'http://localhost:19006') ? _origin : 'https://group-event.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Notification ID is required' });

  try {
    const [existing] = await sql`SELECT * FROM notifications WHERE id = ${id}`;

    if (!existing) return res.status(404).json({ error: 'Notification not found' });
    if (existing.status === 'sent') return res.status(400).json({ error: 'Notification has already been sent' });

    // Fetch all registered push tokens
    const tokenRows = await sql`SELECT token FROM push_tokens`;
    const tokens = tokenRows.map(r => r.token).filter(Boolean);

    // Send via Expo Push API
    let pushSuccessCount = 0;
    let pushFailCount = 0;

    if (tokens.length > 0) {
      const messages = tokens.map(token => ({
        to: token,
        sound: 'default',
        title: existing.title,
        body: existing.body,
      }));

      // Expo push API accepts up to 100 messages per request
      const chunkSize = 100;
      for (let i = 0; i < messages.length; i += chunkSize) {
        const chunk = messages.slice(i, i + chunkSize);
        try {
          const pushRes = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Accept-Encoding': 'gzip, deflate',
            },
            body: JSON.stringify(chunk),
          });

          const pushData = await pushRes.json();
          const results = pushData.data || [];
          results.forEach(r => {
            if (r.status === 'ok') pushSuccessCount++;
            else pushFailCount++;
          });
        } catch (err) {
          console.error('Expo push chunk failed:', err);
          pushFailCount += chunk.length;
        }
      }
    }

    // Mark as sent in DB
    const [notification] = await sql`
      UPDATE notifications SET
        status = 'sent',
        sent_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    console.log(`📱 Push sent: ${pushSuccessCount} ok, ${pushFailCount} failed, ${tokens.length} total tokens`);

    return res.status(200).json({
      message: 'Notification sent successfully',
      notification,
      push: { total: tokens.length, success: pushSuccessCount, failed: pushFailCount },
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    return res.status(500).json({ error: 'Failed to send notification' });
  }
};
