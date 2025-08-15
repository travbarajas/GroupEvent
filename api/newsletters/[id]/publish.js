const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = neon(process.env.DATABASE_URL);

module.exports = async function handler(req, res) {
  console.log(`📧 Newsletter Publish API: ${req.method} ${req.url}`);
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
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

    // For now, allow all publishing. In production, check device_id permissions
    // if (existingNewsletter.created_by_device_id !== device_id) {
    //   return res.status(403).json({ error: 'Not authorized to publish this newsletter' });
    // }

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
      details: error.message 
    });
  }
}