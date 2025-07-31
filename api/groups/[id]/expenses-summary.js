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

    // Simple query first - just count all expenses
    const simpleCount = await sql`SELECT COUNT(*) as total FROM group_expenses`;
    console.log('Total expenses in database:', simpleCount[0]?.total);

    const summary = {
      totalAmount: 0,
      expenseCount: parseInt(simpleCount[0]?.total) || 0,
      userOwes: 0,
      eventsWithExpenses: 0
    };

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