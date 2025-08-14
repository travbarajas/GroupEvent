const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = neon(process.env.DATABASE_URL);

module.exports = async function handler(req, res) {
  console.log(`📧 Newsletter API: ${req.method} ${req.url}`);
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    switch (req.method) {
      case 'GET':
        return await getNewsletters(req, res);
      case 'POST':
        return await createNewsletter(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('❌ Newsletter API Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}

// GET /api/newsletters - Get all newsletters
async function getNewsletters(req, res) {
  const { device_id } = req.query;
  
  if (!device_id) {
    return res.status(400).json({ error: 'device_id is required' });
  }

  try {
    // For now, allow all users to read newsletters
    // In production, you might want to add user authentication
    const newsletters = await sql`
      SELECT * FROM newsletters 
      ORDER BY created_at DESC
    `;

    console.log(`✅ Fetched ${newsletters?.length || 0} newsletters`);
    return res.status(200).json({ newsletters: newsletters || [] });
  } catch (error) {
    console.error('Error in getNewsletters:', error);
    return res.status(500).json({ error: 'Failed to fetch newsletters' });
  }
}

// POST /api/newsletters - Create new newsletter
async function createNewsletter(req, res) {
  const { device_id, ...newsletterData } = req.body;
  
  if (!device_id) {
    return res.status(400).json({ error: 'device_id is required' });
  }

  try {
    // Create newsletter record
    const newsletter = await sql`
      INSERT INTO newsletters (
        title, subtitle, date, read_online_url, content, events, blocks,
        start_date, end_date, created_by_device_id, is_published, 
        created_at, updated_at
      ) VALUES (
        ${newsletterData.title},
        ${newsletterData.subtitle || ''},
        ${newsletterData.date},
        ${newsletterData.readOnlineUrl || ''},
        ${newsletterData.content || ''},
        ${JSON.stringify(newsletterData.events || [])},
        ${newsletterData.blocks || '[]'},
        ${newsletterData.startDate || ''},
        ${newsletterData.endDate || ''},
        ${device_id},
        false,
        ${new Date().toISOString()},
        ${new Date().toISOString()}
      )
      RETURNING *
    `;

    const createdNewsletter = newsletter[0];
    console.log('✅ Newsletter created:', createdNewsletter.id);
    return res.status(201).json({
      id: createdNewsletter.id,
      title: createdNewsletter.title,
      subtitle: createdNewsletter.subtitle,
      date: createdNewsletter.date,
      readOnlineUrl: createdNewsletter.read_online_url,
      content: createdNewsletter.content,
      events: createdNewsletter.events,
      blocks: createdNewsletter.blocks,
      startDate: createdNewsletter.start_date,
      endDate: createdNewsletter.end_date,
      created_at: createdNewsletter.created_at,
      published_at: createdNewsletter.published_at,
      isPublished: createdNewsletter.is_published
    });
  } catch (error) {
    console.error('Error in createNewsletter:', error);
    return res.status(500).json({ error: 'Failed to create newsletter' });
  }
}