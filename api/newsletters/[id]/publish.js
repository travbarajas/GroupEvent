const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = neon(process.env.DATABASE_URL);

module.exports = async function handler(req, res) {
  console.log(`📧 Newsletter Publish API: ${req.method} ${req.url}`);
  
  // CORS headers
  const _origin = req.headers.origin || ''; res.setHeader('Access-Control-Allow-Origin', (_origin === 'https://group-event.vercel.app' || _origin.endsWith('.exp.direct') || _origin === 'http://localhost:8081' || _origin === 'http://localhost:19006') ? _origin : 'https://group-event.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const { device_id } = req.body;
  
  if (!id) {
    return res.status(400).json({ error: 'Newsletter ID is required' });
  }
  
  if (!device_id) {
    return res.status(400).json({ error: 'device_id is required' });
  }

  try {
    // Check if newsletter exists
    const existingNewsletters = await sql`
      SELECT * FROM newsletters 
      WHERE id = ${id}
    `;

    if (!existingNewsletters || existingNewsletters.length === 0) {
      return res.status(404).json({ error: 'Newsletter not found' });
    }

    const existingNewsletter = existingNewsletters[0];
    
    if (existingNewsletter.is_published) {
      console.log('📧 Newsletter already published, returning current state');
      return res.status(200).json({
        id: existingNewsletter.id,
        title: existingNewsletter.title,
        subtitle: existingNewsletter.subtitle,
        date: existingNewsletter.date,
        readOnlineUrl: existingNewsletter.read_online_url,
        content: existingNewsletter.content,
        events: existingNewsletter.events,
        blocks: existingNewsletter.blocks,
        startDate: existingNewsletter.start_date,
        endDate: existingNewsletter.end_date,
        created_at: existingNewsletter.created_at,
        published_at: existingNewsletter.published_at,
        isPublished: existingNewsletter.is_published,
        message: 'Newsletter was already published'
      });
    }

    if (existingNewsletter.created_by_device_id && existingNewsletter.created_by_device_id !== device_id) {
      return res.status(403).json({ error: 'Not authorized to publish this newsletter' });
    }

    // Update newsletter to published status
    const newsletters = await sql`
      UPDATE newsletters 
      SET 
        is_published = true,
        published_at = ${new Date().toISOString()},
        updated_at = ${new Date().toISOString()}
      WHERE id = ${id}
      RETURNING *
    `;

    if (!newsletters || newsletters.length === 0) {
      console.error('Error publishing newsletter - no rows returned');
      return res.status(500).json({ error: 'Failed to publish newsletter' });
    }

    const newsletter = newsletters[0];

    console.log('✅ Newsletter published:', id);

    // Bump cache version so all clients fetch fresh data on next open
    try {
      const newVersion = Date.now().toString();
      await sql`
        INSERT INTO app_config (key, value, updated_at)
        VALUES ('cache_version', ${newVersion}, NOW())
        ON CONFLICT (key) DO UPDATE SET value = ${newVersion}, updated_at = NOW()
      `;
      console.log('✅ Cache version bumped:', newVersion);
    } catch (cacheError) {
      console.error('⚠️ Failed to bump cache version (non-fatal):', cacheError);
    }

    // TODO: Send push notifications here
    // You would integrate with your push notification service
    console.log('📱 Push notifications would be sent here for newsletter:', newsletter.title);

    return res.status(200).json({
      id: newsletter.id,
      title: newsletter.title,
      subtitle: newsletter.subtitle,
      date: newsletter.date,
      readOnlineUrl: newsletter.read_online_url,
      content: newsletter.content,
      events: newsletter.events,
      blocks: newsletter.blocks,
      startDate: newsletter.start_date,
      endDate: newsletter.end_date,
      created_at: newsletter.created_at,
      published_at: newsletter.published_at,
      isPublished: newsletter.is_published,
      message: 'Newsletter published successfully'
    });
  } catch (error) {
    console.error('❌ Newsletter Publish Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
    });
  }
}