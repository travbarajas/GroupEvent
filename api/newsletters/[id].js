const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = neon(process.env.DATABASE_URL);

module.exports = async function handler(req, res) {
  console.log(`📧 Newsletter [ID] API: ${req.method} ${req.url}`);
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query;
  
  if (!id) {
    return res.status(400).json({ error: 'Newsletter ID is required' });
  }

  try {
    switch (req.method) {
      case 'GET':
        return await getNewsletter(req, res, id);
      case 'PUT':
        return await updateNewsletter(req, res, id);
      case 'DELETE':
        return await deleteNewsletter(req, res, id);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('❌ Newsletter [ID] API Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}

// GET /api/newsletters/[id] - Get specific newsletter
async function getNewsletter(req, res, newsletterId) {
  try {
    const newsletters = await sql`
      SELECT * FROM newsletters 
      WHERE id = ${newsletterId}
    `;

    if (!newsletters || newsletters.length === 0) {
      return res.status(404).json({ error: 'Newsletter not found' });
    }

    const newsletter = newsletters[0];
    return res.status(200).json({
      id: newsletter.id,
      title: newsletter.title,
      subtitle: newsletter.subtitle,
      date: newsletter.date,
      readOnlineUrl: newsletter.read_online_url,
      content: newsletter.content,
      events: newsletter.events,
      startDate: newsletter.start_date,
      endDate: newsletter.end_date,
      created_at: newsletter.created_at,
      published_at: newsletter.published_at,
      isPublished: newsletter.is_published
    });
  } catch (error) {
    console.error('Error in getNewsletter:', error);
    return res.status(500).json({ error: 'Failed to fetch newsletter' });
  }
}

// PUT /api/newsletters/[id] - Update newsletter
async function updateNewsletter(req, res, newsletterId) {
  const { device_id, ...updateData } = req.body;
  
  if (!device_id) {
    return res.status(400).json({ error: 'device_id is required' });
  }

  try {
    // Check if newsletter exists and user has permission
    const existingNewsletters = await sql`
      SELECT created_by_device_id FROM newsletters 
      WHERE id = ${newsletterId}
    `;

    if (!existingNewsletters || existingNewsletters.length === 0) {
      return res.status(404).json({ error: 'Newsletter not found' });
    }

    // For now, allow all updates. In production, check device_id permissions
    // if (existingNewsletters[0].created_by_device_id !== device_id) {
    //   return res.status(403).json({ error: 'Not authorized to update this newsletter' });
    // }

    // Update newsletter with provided fields
    const newsletters = await sql`
      UPDATE newsletters 
      SET 
        title = COALESCE(${updateData.title}, title),
        subtitle = COALESCE(${updateData.subtitle}, subtitle),
        date = COALESCE(${updateData.date}, date),
        read_online_url = COALESCE(${updateData.readOnlineUrl}, read_online_url),
        content = COALESCE(${updateData.content}, content),
        events = COALESCE(${updateData.events ? JSON.stringify(updateData.events) : null}, events),
        start_date = COALESCE(${updateData.startDate}, start_date),
        end_date = COALESCE(${updateData.endDate}, end_date),
        updated_at = ${new Date().toISOString()}
      WHERE id = ${newsletterId}
      RETURNING *
    `;

    if (!newsletters || newsletters.length === 0) {
      console.error('Error updating newsletter - no rows returned');
      return res.status(500).json({ error: 'Failed to update newsletter' });
    }

    const newsletter = newsletters[0];
    console.log('✅ Newsletter updated:', newsletterId);
    return res.status(200).json({
      id: newsletter.id,
      title: newsletter.title,
      subtitle: newsletter.subtitle,
      date: newsletter.date,
      readOnlineUrl: newsletter.read_online_url,
      content: newsletter.content,
      events: newsletter.events,
      startDate: newsletter.start_date,
      endDate: newsletter.end_date,
      created_at: newsletter.created_at,
      published_at: newsletter.published_at,
      isPublished: newsletter.is_published
    });
  } catch (error) {
    console.error('Error in updateNewsletter:', error);
    return res.status(500).json({ error: 'Failed to update newsletter' });
  }
}

// DELETE /api/newsletters/[id] - Delete newsletter
async function deleteNewsletter(req, res, newsletterId) {
  const { device_id } = req.body;
  
  if (!device_id) {
    return res.status(400).json({ error: 'device_id is required' });
  }

  try {
    // Check if newsletter exists
    const existingNewsletters = await sql`
      SELECT created_by_device_id FROM newsletters 
      WHERE id = ${newsletterId}
    `;

    if (!existingNewsletters || existingNewsletters.length === 0) {
      return res.status(404).json({ error: 'Newsletter not found' });
    }

    // For now, allow all deletions. In production, check device_id permissions
    // if (existingNewsletters[0].created_by_device_id !== device_id) {
    //   return res.status(403).json({ error: 'Not authorized to delete this newsletter' });
    // }

    await sql`
      DELETE FROM newsletters 
      WHERE id = ${newsletterId}
    `;

    console.log('✅ Newsletter deleted:', newsletterId);
    return res.status(200).json({ message: 'Newsletter deleted successfully' });
  } catch (error) {
    console.error('Error in deleteNewsletter:', error);
    return res.status(500).json({ error: 'Failed to delete newsletter' });
  }
}