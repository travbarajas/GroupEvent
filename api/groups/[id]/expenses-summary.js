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

    // Get total expenses and count for the group
    const [totals] = await sql`
      SELECT 
        COALESCE(SUM(total_amount::decimal), 0) as total_amount,
        COUNT(*) as expense_count
      FROM group_expenses 
      WHERE group_id = ${groupId}
    `;

    // Get amount the current user owes (unpaid expenses only)
    const [userOwes] = await sql`
      SELECT COALESCE(SUM(individual_amount::decimal), 0) as user_owes
      FROM expense_participants ep
      JOIN group_expenses ge ON ep.expense_id = ge.id
      WHERE ge.group_id = ${groupId} 
        AND ep.member_device_id = ${device_id} 
        AND ep.payment_status = 'pending'
    `;

    // Get count of events with expenses
    const [eventCount] = await sql`
      SELECT COUNT(DISTINCT event_id) as events_with_expenses
      FROM group_expenses 
      WHERE group_id = ${groupId} 
        AND event_id IS NOT NULL
    `;

    const summary = {
      totalAmount: parseFloat(totals.total_amount) || 0,
      expenseCount: parseInt(totals.expense_count) || 0,
      userOwes: parseFloat(userOwes.user_owes) || 0,
      eventsWithExpenses: parseInt(eventCount.events_with_expenses) || 0
    };

    return res.status(200).json({ summary });

  } catch (error) {
    console.error('Error fetching expense summary:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};