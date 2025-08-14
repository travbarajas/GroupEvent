import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
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
    const { data: newsletters, error } = await supabase
      .from('newsletters')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching newsletters:', error);
      return res.status(500).json({ error: 'Failed to fetch newsletters' });
    }

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
    const { data: newsletter, error } = await supabase
      .from('newsletters')
      .insert([{
        title: newsletterData.title,
        subtitle: newsletterData.subtitle || '',
        date: newsletterData.date,
        read_online_url: newsletterData.readOnlineUrl || '',
        content: newsletterData.content || '',
        events: newsletterData.events || [],
        start_date: newsletterData.startDate || '',
        end_date: newsletterData.endDate || '',
        created_by_device_id: device_id,
        is_published: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating newsletter:', error);
      return res.status(500).json({ error: 'Failed to create newsletter' });
    }

    console.log('✅ Newsletter created:', newsletter.id);
    return res.status(201).json({
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
    console.error('Error in createNewsletter:', error);
    return res.status(500).json({ error: 'Failed to create newsletter' });
  }
}