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
      const { device_id, description, total_amount, paid_by, split_between } = req.body;
      
      console.log('POST expense request:', { groupId, device_id, description, total_amount, paid_by, split_between });
      
      if (!device_id) {
        return res.status(400).json({ error: 'device_id is required' });
      }

      if (!description || !total_amount || !paid_by || !split_between) {
        return res.status(400).json({ error: 'description, total_amount, paid_by, and split_between are required' });
      }

      // Check if user is a member of this group
      const [membership] = await sql`
        SELECT 1 FROM members WHERE group_id = ${groupId} AND device_id = ${device_id}
      `;

      if (!membership) {
        return res.status(403).json({ error: 'You are not a member of this group' });
      }

      console.log('Membership check passed, creating expense...');

      // For now, let's try without the UUID cast since group IDs might be strings
      const [newExpense] = await sql`
        INSERT INTO group_expenses (group_id, description, total_amount, created_by_device_id)
        VALUES (${groupId}, ${description}, ${total_amount}, ${device_id})
        RETURNING *
      `;

      console.log('Expense created:', newExpense);

      // Calculate individual amount for owers
      const individualAmount = parseFloat(total_amount) / split_between.length;
      console.log('Individual amount:', individualAmount);

      // Insert payers (let database generate UUIDs)
      for (const payerId of paid_by) {
        console.log('Inserting payer:', payerId);
        await sql`
          INSERT INTO expense_participants (expense_id, member_device_id, role, individual_amount, payment_status)
          VALUES (${newExpense.id}, ${payerId}, 'payer', ${individualAmount}, 'completed')
        `;
      }

      // Insert owers (let database generate UUIDs)
      for (const owerId of split_between) {
        console.log('Inserting ower:', owerId);
        await sql`
          INSERT INTO expense_participants (expense_id, member_device_id, role, individual_amount, payment_status)  
          VALUES (${newExpense.id}, ${owerId}, 'ower', ${individualAmount}, 'pending')
        `;
      }
      
      console.log('Expense creation completed successfully');
      return res.status(201).json({ success: true, expense: newExpense });

    } catch (error) {
      console.error('Error creating expense:', error);
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
      return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};