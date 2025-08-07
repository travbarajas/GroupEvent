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
      // Get all expenses for this group with participants in new format
      let expenses = [];
      
      try {
        const rawExpenses = await sql`
          SELECT 
            ge.id,
            ge.group_id,
            ge.description,
            ge.total_amount,
            ge.created_by_device_id,
            ge.created_at,
            ge.updated_at
          FROM group_expenses ge
          WHERE ge.group_id = ${groupId}
          ORDER BY ge.created_at DESC
        `;

        // For each expense, get participants in the new format
        for (const expense of rawExpenses) {
          const participants = await sql`
            SELECT member_device_id, role, individual_amount, payment_status
            FROM expense_participants
            WHERE expense_id = ${expense.id}
          `;

          expenses.push({
            id: expense.id,
            group_id: expense.group_id,
            description: expense.description,
            total_amount: parseFloat(expense.total_amount),
            created_by_device_id: expense.created_by_device_id,
            created_at: expense.created_at,
            updated_at: expense.updated_at,
            participants: participants.map(p => ({
              member_device_id: p.member_device_id,
              role: p.role,
              individual_amount: parseFloat(p.individual_amount),
              payment_status: p.payment_status
            }))
          });
        }
      } catch (tableError) {
        console.log('Table query error, returning empty expenses:', tableError.message);
        expenses = [];
      }
      
      return res.status(200).json(expenses);
    } catch (error) {
      console.error('Error fetching group expenses:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { description, total_amount, created_by_device_id, participants } = req.body;
      
      if (!created_by_device_id) {
        return res.status(400).json({ error: 'created_by_device_id is required' });
      }

      if (!description || !total_amount || !participants || participants.length === 0) {
        return res.status(400).json({ error: 'description, total_amount, and participants are required' });
      }

      // Check if user is a member of this group
      const [membership] = await sql`
        SELECT 1 FROM members WHERE group_id = ${groupId} AND device_id = ${created_by_device_id}
      `;

      if (!membership) {
        return res.status(403).json({ error: 'You are not a member of this group' });
      }

      // Start transaction
      await sql`BEGIN`;
      
      try {
        // Create the expense
        const [newExpense] = await sql`
          INSERT INTO group_expenses (group_id, description, total_amount, created_by_device_id)
          VALUES (${groupId}, ${description}, ${total_amount}, ${created_by_device_id})
          RETURNING *
        `;

        // Insert participants
        for (const participant of participants) {
          await sql`
            INSERT INTO expense_participants (id, expense_id, member_device_id, role, individual_amount, payment_status)
            VALUES (gen_random_uuid(), ${newExpense.id}, ${participant.member_device_id}, ${participant.role}, ${participant.individual_amount}, ${participant.payment_status})
          `;
        }

        await sql`COMMIT`;
        
        return res.status(201).json({ 
          success: true, 
          expenseId: newExpense.id,
          message: 'Expense created successfully' 
        });
      } catch (transactionError) {
        await sql`ROLLBACK`;
        throw transactionError;
      }

    } catch (error) {
      console.error('Error creating expense:', error);
      return res.status(500).json({ 
        error: 'Failed to create expense',
        details: error.message
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};