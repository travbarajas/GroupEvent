import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return getGroupAvailability(req, res);
  } else if (req.method === 'POST') {
    return saveUserAvailability(req, res);
  } else if (req.method === 'PUT') {
    return updateUserAvailability(req, res);
  } else if (req.method === 'DELETE') {
    return deleteUserAvailability(req, res);
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    res.status(405).json({ error: 'Method not allowed' });
  }
}

async function getGroupAvailability(req, res) {
  try {
    const { groupId, startDate, endDate } = req.query;

    if (!groupId) {
      return res.status(400).json({ error: 'Group ID is required' });
    }

    // Get all availability slots for the group within the date range
    let query = supabase
      .from('group_availability')
      .select(`
        *,
        member:group_members!group_availability_member_id_fkey (
          username,
          device_id
        )
      `)
      .eq('group_id', groupId);

    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data, error } = await query.order('date', { ascending: true });

    if (error) {
      console.error('Error fetching group availability:', error);
      return res.status(500).json({ error: 'Failed to fetch group availability' });
    }

    // Transform the data for easier client-side processing
    const availabilityByMember = data.reduce((acc, slot) => {
      const memberId = slot.member_id;
      if (!acc[memberId]) {
        acc[memberId] = {
          memberId,
          username: slot.member?.username,
          deviceId: slot.member?.device_id,
          slots: []
        };
      }
      acc[memberId].slots.push({
        date: slot.date,
        startHour: slot.start_hour,
        endHour: slot.end_hour,
        id: slot.id
      });
      return acc;
    }, {});

    res.status(200).json({
      availability: Object.values(availabilityByMember),
      totalMembers: Object.keys(availabilityByMember).length
    });
  } catch (error) {
    console.error('Error in getGroupAvailability:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function saveUserAvailability(req, res) {
  try {
    const { groupId, memberId, deviceId, slots } = req.body;

    if (!groupId || !memberId || !deviceId || !slots || !Array.isArray(slots)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify the member belongs to the group
    const { data: memberData, error: memberError } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('device_id', deviceId)
      .single();

    if (memberError || !memberData) {
      return res.status(403).json({ error: 'Member not found in group' });
    }

    // Delete existing availability for these dates
    const dates = [...new Set(slots.map(slot => slot.date))];
    const { error: deleteError } = await supabase
      .from('group_availability')
      .delete()
      .eq('group_id', groupId)
      .eq('member_id', memberId)
      .in('date', dates);

    if (deleteError) {
      console.error('Error deleting old availability:', deleteError);
      return res.status(500).json({ error: 'Failed to update availability' });
    }

    // Insert new availability slots
    if (slots.length > 0) {
      const availabilityData = slots.map(slot => ({
        group_id: groupId,
        member_id: memberId,
        date: slot.date,
        start_hour: slot.startHour,
        end_hour: slot.endHour,
        created_at: new Date().toISOString()
      }));

      const { data, error } = await supabase
        .from('group_availability')
        .insert(availabilityData)
        .select();

      if (error) {
        console.error('Error saving availability:', error);
        return res.status(500).json({ error: 'Failed to save availability' });
      }

      res.status(201).json({ message: 'Availability saved successfully', data });
    } else {
      res.status(200).json({ message: 'Availability cleared successfully' });
    }
  } catch (error) {
    console.error('Error in saveUserAvailability:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateUserAvailability(req, res) {
  try {
    const { groupId, memberId, deviceId, slots } = req.body;

    if (!groupId || !memberId || !deviceId || !slots || !Array.isArray(slots)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify the member belongs to the group
    const { data: memberData, error: memberError } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('device_id', deviceId)
      .single();

    if (memberError || !memberData) {
      return res.status(403).json({ error: 'Member not found in group' });
    }

    // Process each slot for update/insert
    const results = [];
    for (const slot of slots) {
      if (slot.id) {
        // Update existing slot
        const { data, error } = await supabase
          .from('group_availability')
          .update({
            date: slot.date,
            start_hour: slot.startHour,
            end_hour: slot.endHour,
            updated_at: new Date().toISOString()
          })
          .eq('id', slot.id)
          .eq('member_id', memberId)
          .select();

        if (error) {
          console.error('Error updating availability slot:', error);
          return res.status(500).json({ error: 'Failed to update availability' });
        }
        results.push(...data);
      } else {
        // Insert new slot
        const { data, error } = await supabase
          .from('group_availability')
          .insert({
            group_id: groupId,
            member_id: memberId,
            date: slot.date,
            start_hour: slot.startHour,
            end_hour: slot.endHour,
            created_at: new Date().toISOString()
          })
          .select();

        if (error) {
          console.error('Error inserting availability slot:', error);
          return res.status(500).json({ error: 'Failed to save availability' });
        }
        results.push(...data);
      }
    }

    res.status(200).json({ message: 'Availability updated successfully', data: results });
  } catch (error) {
    console.error('Error in updateUserAvailability:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function deleteUserAvailability(req, res) {
  try {
    const { groupId, memberId, deviceId, slotIds } = req.body;

    if (!groupId || !memberId || !deviceId || !slotIds || !Array.isArray(slotIds)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify the member belongs to the group
    const { data: memberData, error: memberError } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('device_id', deviceId)
      .single();

    if (memberError || !memberData) {
      return res.status(403).json({ error: 'Member not found in group' });
    }

    // Delete the specified availability slots
    const { error } = await supabase
      .from('group_availability')
      .delete()
      .in('id', slotIds)
      .eq('member_id', memberId);

    if (error) {
      console.error('Error deleting availability:', error);
      return res.status(500).json({ error: 'Failed to delete availability' });
    }

    res.status(200).json({ message: 'Availability deleted successfully' });
  } catch (error) {
    console.error('Error in deleteUserAvailability:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}