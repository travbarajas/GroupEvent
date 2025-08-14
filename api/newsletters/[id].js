import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
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
    const { data: newsletter, error } = await supabase
      .from('newsletters')
      .select('*')
      .eq('id', newsletterId)
      .single();

    if (error || !newsletter) {
      return res.status(404).json({ error: 'Newsletter not found' });
    }

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
    const { data: existingNewsletter, error: fetchError } = await supabase
      .from('newsletters')
      .select('created_by_device_id')
      .eq('id', newsletterId)
      .single();

    if (fetchError || !existingNewsletter) {
      return res.status(404).json({ error: 'Newsletter not found' });
    }

    // For now, allow all updates. In production, check device_id permissions
    // if (existingNewsletter.created_by_device_id !== device_id) {
    //   return res.status(403).json({ error: 'Not authorized to update this newsletter' });
    // }

    const updatePayload = {
      updated_at: new Date().toISOString()
    };

    // Map frontend field names to database field names
    if (updateData.title !== undefined) updatePayload.title = updateData.title;
    if (updateData.subtitle !== undefined) updatePayload.subtitle = updateData.subtitle;
    if (updateData.date !== undefined) updatePayload.date = updateData.date;
    if (updateData.readOnlineUrl !== undefined) updatePayload.read_online_url = updateData.readOnlineUrl;
    if (updateData.content !== undefined) updatePayload.content = updateData.content;
    if (updateData.events !== undefined) updatePayload.events = updateData.events;
    if (updateData.startDate !== undefined) updatePayload.start_date = updateData.startDate;
    if (updateData.endDate !== undefined) updatePayload.end_date = updateData.endDate;

    const { data: newsletter, error } = await supabase
      .from('newsletters')
      .update(updatePayload)
      .eq('id', newsletterId)
      .select()
      .single();

    if (error) {
      console.error('Error updating newsletter:', error);
      return res.status(500).json({ error: 'Failed to update newsletter' });
    }

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
    const { data: existingNewsletter, error: fetchError } = await supabase
      .from('newsletters')
      .select('created_by_device_id')
      .eq('id', newsletterId)
      .single();

    if (fetchError || !existingNewsletter) {
      return res.status(404).json({ error: 'Newsletter not found' });
    }

    // For now, allow all deletions. In production, check device_id permissions
    // if (existingNewsletter.created_by_device_id !== device_id) {
    //   return res.status(403).json({ error: 'Not authorized to delete this newsletter' });
    // }

    const { error } = await supabase
      .from('newsletters')
      .delete()
      .eq('id', newsletterId);

    if (error) {
      console.error('Error deleting newsletter:', error);
      return res.status(500).json({ error: 'Failed to delete newsletter' });
    }

    console.log('✅ Newsletter deleted:', newsletterId);
    return res.status(200).json({ message: 'Newsletter deleted successfully' });
  } catch (error) {
    console.error('Error in deleteNewsletter:', error);
    return res.status(500).json({ error: 'Failed to delete newsletter' });
  }
}