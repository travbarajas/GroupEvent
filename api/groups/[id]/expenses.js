const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = neon(process.env.DATABASE_URL);

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const { id: groupId } = req.query;
  
  if (req.method === 'GET') {
    try {
      const { device_id } = req.query;
      
      if (!device_id) {
        return res.status(400).json({ error: 'device_id is required' });
      }

      // Check if user is a member of this group
      const [membership] = await sql`
        SELECT 1 FROM members WHERE group_id = ${groupId} AND device_id = ${device_id}
      `;

      if (!membership) {
        return res.status(403).json({ error: 'You are not a member of this group' });
      }

      // Get all expenses for this group (simplified query to avoid empty table issues)
      let expenses = [];
      
      try {
        // First check if any expenses exist for this group
        const expenseCount = await sql`
          SELECT COUNT(*) as count FROM group_expenses WHERE group_id = ${groupId}
        `;
        
        if (expenseCount[0].count > 0) {
          // Get expenses with participant data
          expenses = await sql`
            SELECT 
              ge.id,
              ge.description,
              ge.total_amount,
              ge.created_by_device_id,
              ge.created_at,
              COALESCE(
                array_agg(
                  CASE WHEN ep.role = 'payer' THEN ep.member_device_id END
                ) FILTER (WHERE ep.role = 'payer'), 
                ARRAY[]::text[]
              ) as payers,
              COALESCE(
                array_agg(
                  CASE WHEN ep.role = 'ower' THEN ep.member_device_id END  
                ) FILTER (WHERE ep.role = 'ower'), 
                ARRAY[]::text[]
              ) as owers,
              COALESCE(
                jsonb_object_agg(
                  CASE WHEN ep.role = 'ower' THEN ep.member_device_id END,
                  CASE WHEN ep.role = 'ower' THEN ep.payment_status END
                ) FILTER (WHERE ep.role = 'ower'), 
                '{}'::jsonb
              ) as payment_status,
              CASE 
                WHEN COUNT(CASE WHEN ep.role = 'ower' THEN 1 END) > 0
                THEN ge.total_amount / COUNT(CASE WHEN ep.role = 'ower' THEN 1 END)
                ELSE 0
              END as individual_amount
            FROM group_expenses ge
            LEFT JOIN expense_participants ep ON ge.id = ep.expense_id
            WHERE ge.group_id = ${groupId}
            GROUP BY ge.id, ge.description, ge.total_amount, ge.created_by_device_id, ge.created_at
            ORDER BY ge.created_at DESC
          `;
        }
      } catch (tableError) {
        console.log('Table query error, returning empty expenses:', tableError.message);
        expenses = [];
      }
      
      return res.status(200).json({ expenses });
    } catch (error) {
      console.error('Error fetching group expenses:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'POST') {
    try {
      // Return success immediately to test if the endpoint is reachable
      return res.status(200).json({ 
        message: 'Endpoint reached successfully',
        groupId,
        body: req.body,
        method: req.method
      });

    } catch (error) {
      console.error('Error in POST handler:', error);
      return res.status(500).json({ 
        error: 'Internal server error', 
        details: error.message,
        stack: error.stack 
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};