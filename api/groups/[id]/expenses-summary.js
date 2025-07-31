const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = neon(process.env.DATABASE_URL);

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { id: groupId } = req.query;
  const { device_id } = req.query;
  
  if (!device_id) {
    return res.status(400).json({ error: 'device_id is required' });
  }
  
  try {
    // Check if user is a member of this group
    const [membership] = await sql`
      SELECT 1 FROM members WHERE group_id = ${groupId} AND device_id = ${device_id}
    `;

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    // Check if expense tables exist first
    const tableCheck = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('group_expenses', 'expense_participants')
    `;
    
    console.log('Available expense tables:', tableCheck.map(t => t.table_name));
    
    // If tables don't exist, return empty data
    if (tableCheck.length === 0) {
      console.log('Expense tables do not exist yet');
      return res.status(200).json({ 
        summary: {
          totalAmount: 0,
          expenseCount: 0,
          userOwes: 0,
          eventsWithExpenses: 0
        }
      });
    }

    // Get actual expense data for this group
    const totalsResult = await sql`
      SELECT 
        COALESCE(SUM(CAST(total_amount AS DECIMAL)), 0) as total_amount,
        COUNT(*) as expense_count
      FROM group_expenses 
      WHERE group_id = ${groupId}
    `;
    const totals = totalsResult[0] || { total_amount: 0, expense_count: 0 };
    
    console.log('Group expenses for group', groupId, ':', totals);

    // Debug: Check what participants exist for this user
    const debugParticipants = await sql`
      SELECT ep.*, ge.description 
      FROM expense_participants ep
      JOIN group_expenses ge ON ep.expense_id = ge.id
      WHERE ge.group_id = ${groupId} 
        AND ep.member_device_id = ${device_id}
      LIMIT 5
    `;
    console.log('User participant records:', debugParticipants);

    // Debug: Check ALL participants for this group to see what device IDs exist
    const allParticipants = await sql`
      SELECT DISTINCT ep.member_device_id, ep.role, COUNT(*) as count
      FROM expense_participants ep
      JOIN group_expenses ge ON ep.expense_id = ge.id
      WHERE ge.group_id = ${groupId}
      GROUP BY ep.member_device_id, ep.role
      LIMIT 10
    `;
    console.log('All participant device IDs in group:', allParticipants);
    console.log('Looking for device ID:', device_id);

    // Debug: Check if there's a mapping in members table
    const memberMapping = await sql`
      SELECT id, device_id, username 
      FROM members 
      WHERE group_id = ${groupId}
      LIMIT 10
    `;
    console.log('Members in group:', memberMapping);

    // Get the member ID for this device_id to bridge the ID formats
    const [memberRecord] = await sql`
      SELECT id FROM members WHERE group_id = ${groupId} AND device_id = ${device_id}
    `;
    
    if (!memberRecord) {
      console.log('No member record found for device_id:', device_id);
      return res.status(200).json({ 
        summary: {
          totalAmount: parseFloat(totals.total_amount) || 0,
          expenseCount: parseInt(totals.expense_count) || 0,
          userOwes: 0,
          userOwed: 0,
          eventsWithExpenses: 0
        }
      });
    }

    const memberId = memberRecord.id;
    console.log('Found member ID:', memberId, 'for device_id:', device_id);

    // Get amount the current user owes (as an ower with pending status)
    const userOwesResult = await sql`
      SELECT COALESCE(SUM(CAST(individual_amount AS DECIMAL)), 0) as user_owes
      FROM expense_participants ep
      JOIN group_expenses ge ON ep.expense_id = ge.id
      WHERE ge.group_id = ${groupId} 
        AND ep.member_device_id = ${memberId}
        AND ep.role = 'ower'
        AND ep.payment_status = 'pending'
    `;
    const userOwes = userOwesResult[0] || { user_owes: 0 };

    // Get amount the current user is owed (as a payer for expenses with pending owers)
    const userOwedResult = await sql`
      SELECT COALESCE(SUM(CAST(ep_ower.individual_amount AS DECIMAL)), 0) as user_owed
      FROM expense_participants ep_payer
      JOIN group_expenses ge ON ep_payer.expense_id = ge.id
      JOIN expense_participants ep_ower ON ge.id = ep_ower.expense_id
      WHERE ge.group_id = ${groupId}
        AND ep_payer.member_device_id = ${memberId}
        AND ep_payer.role = 'payer'
        AND ep_ower.role = 'ower'
        AND ep_ower.payment_status = 'pending'
    `;
    const userOwed = userOwedResult[0] || { user_owed: 0 };

    const summary = {
      totalAmount: parseFloat(totals.total_amount) || 0,
      expenseCount: parseInt(totals.expense_count) || 0,
      userOwes: parseFloat(userOwes.user_owes) || 0,
      userOwed: parseFloat(userOwed.user_owed) || 0,
      eventsWithExpenses: 0 // Not tracked in current schema
    };

    console.log('Final summary for user', device_id, ':', summary);

    return res.status(200).json({ summary });

  } catch (error) {
    console.error('Error fetching expense summary:', error);
    console.error('Error details:', error.message);
    console.error('Group ID:', groupId);
    console.error('Device ID:', device_id);
    
    // Return a safe fallback response instead of 500
    return res.status(200).json({ 
      summary: {
        totalAmount: 0,
        expenseCount: 0,
        userOwes: 0,
        eventsWithExpenses: 0
      }
    });
  }
};