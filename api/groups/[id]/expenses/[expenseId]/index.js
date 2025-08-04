const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = neon(process.env.DATABASE_URL);

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method === 'DELETE') {
    try {
      const { id: groupId, expenseId } = req.query;
      const { device_id } = req.body;
      
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

      // Check if expense exists and belongs to this group
      const [expense] = await sql`
        SELECT created_by_device_id FROM group_expenses 
        WHERE id = ${expenseId} AND group_id = ${groupId}
      `;

      if (!expense) {
        return res.status(404).json({ error: 'Expense not found' });
      }

      // Check if the current user is the creator of the expense
      if (expense.created_by_device_id !== device_id) {
        return res.status(403).json({ error: 'Only the expense creator can delete this expense' });
      }

      // Delete expense participants first (foreign key constraint)
      await sql`
        DELETE FROM expense_participants WHERE expense_id = ${expenseId}
      `;

      // Delete the expense
      await sql`
        DELETE FROM group_expenses WHERE id = ${expenseId}
      `;
      
      return res.status(200).json({ success: true, message: 'Expense deleted successfully' });

    } catch (error) {
      console.error('Error deleting expense:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};