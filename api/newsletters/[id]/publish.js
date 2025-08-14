import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
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
    const { data: existingNewsletter, error: fetchError } = await supabase
      .from('newsletters')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingNewsletter) {
      return res.status(404).json({ error: 'Newsletter not found' });
    }

    if (existingNewsletter.is_published) {
      return res.status(400).json({ error: 'Newsletter is already published' });
    }

    // For now, allow all publishing. In production, check device_id permissions
    // if (existingNewsletter.created_by_device_id !== device_id) {
    //   return res.status(403).json({ error: 'Not authorized to publish this newsletter' });
    // }

    // Update newsletter to published status
    const { data: newsletter, error } = await supabase
      .from('newsletters')
      .update({
        is_published: true,
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error publishing newsletter:', error);
      return res.status(500).json({ error: 'Failed to publish newsletter' });
    }

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