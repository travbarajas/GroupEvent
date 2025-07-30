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

      // Get all expenses for this group with proper data structure
      let expenses = [];
      
      try {
        const rawExpenses = await sql`
          SELECT 
            ge.id,
            ge.description,
            ge.total_amount,
            ge.created_by_device_id,
            ge.created_at
          FROM group_expenses ge
          WHERE ge.group_id = ${groupId}
          ORDER BY ge.created_at DESC
        `;

        // For each expense, get participants separately to ensure proper data structure
        for (const expense of rawExpenses) {
          const participants = await sql`
            SELECT member_device_id, role, individual_amount, payment_status
            FROM expense_participants
            WHERE expense_id = ${expense.id}
          `;

          const payers = participants.filter(p => p.role === 'payer').map(p => p.member_device_id);
          const owers = participants.filter(p => p.role === 'ower').map(p => p.member_device_id);
          const paymentStatus = {};
          let individualAmount = 0;

          participants.forEach(p => {
            if (p.role === 'ower') {
              paymentStatus[p.member_device_id] = p.payment_status;
              individualAmount = parseFloat(p.individual_amount);
            }
          });

          expenses.push({
            id: expense.id,
            description: expense.description,
            total_amount: expense.total_amount,
            created_by_device_id: expense.created_by_device_id,
            created_at: expense.created_at,
            payers,
            owers,
            payment_status: paymentStatus,
            individual_amount: individualAmount
          });
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
      console.log('POST request received for groupId:', groupId);
      console.log('Request body:', JSON.stringify(req.body, null, 2));
      
      const { device_id, description, total_amount, paid_by, split_between } = req.body;
      
      if (!device_id) {
        console.log('Missing device_id');
        return res.status(400).json({ error: 'device_id is required' });
      }

      if (!description || !total_amount || !paid_by || !split_between) {
        console.log('Missing required fields:', { description, total_amount, paid_by, split_between });
        return res.status(400).json({ error: 'description, total_amount, paid_by, and split_between are required' });
      }

      console.log('Checking membership for device_id:', device_id, 'in group:', groupId);
      
      // Check if user is a member of this group
      const [membership] = await sql`
        SELECT 1 FROM members WHERE group_id = ${groupId} AND device_id = ${device_id}
      `;

      if (!membership) {
        console.log('User not a member of group');
        return res.status(403).json({ error: 'You are not a member of this group' });
      }

      console.log('Membership verified, creating expense...');

      // Create the expense
      const [newExpense] = await sql`
        INSERT INTO group_expenses (group_id, description, total_amount, created_by_device_id)
        VALUES (${groupId}, ${description}, ${total_amount}, ${device_id})
        RETURNING *
      `;

      console.log('Expense created:', newExpense);

      // Calculate individual amount for owers
      const individualAmount = parseFloat(total_amount) / split_between.length;
      console.log('Individual amount calculated:', individualAmount);

      // Insert payers
      console.log('Inserting payers:', paid_by);
      for (const payerId of paid_by) {
        await sql`
          INSERT INTO expense_participants (id, expense_id, member_device_id, role, individual_amount, payment_status)
          VALUES (gen_random_uuid(), ${newExpense.id}, ${payerId}, 'payer', ${individualAmount}, 'completed')
        `;
      }

      // Insert owers
      console.log('Inserting owers:', split_between);
      for (const owerId of split_between) {
        await sql`
          INSERT INTO expense_participants (id, expense_id, member_device_id, role, individual_amount, payment_status)  
          VALUES (gen_random_uuid(), ${newExpense.id}, ${owerId}, 'ower', ${individualAmount}, 'pending')
        `;
      }
      
      console.log('Expense creation completed successfully');
      return res.status(201).json({ success: true, expense: newExpense });

    } catch (error) {
      console.error('Error creating expense:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      return res.status(500).json({ 
        error: 'Internal server error', 
        details: error.message,
        stack: error.stack?.substring(0, 500) // Truncate stack trace
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};