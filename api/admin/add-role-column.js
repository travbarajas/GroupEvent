const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method === 'POST') {
    try {
      console.log('Adding role column to members table...');
      
      // First, try to add the role column if it doesn't exist
      try {
        await sql`
          ALTER TABLE members 
          ADD COLUMN role VARCHAR(20) DEFAULT 'member'
        `;
        console.log('Successfully added role column');
      } catch (error) {
        // Column might already exist, that's OK
        console.log('Role column might already exist:', error.message);
      }
      
      // Update existing members to have 'member' role if they don't have a role
      const updateResult = await sql`
        UPDATE members 
        SET role = 'member' 
        WHERE role IS NULL OR role = ''
      `;
      console.log('Updated existing members:', updateResult);
      
      // Get all members to show current state
      const allMembers = await sql`
        SELECT m.*, g.name as group_name 
        FROM members m
        JOIN groups g ON m.group_id = g.id
        ORDER BY m.group_id, m.id
      `;
      
      return res.status(200).json({
        success: true,
        message: 'Role column added and existing members updated',
        members: allMembers,
        updated_count: updateResult.length || 0
      });
    } catch (error) {
      console.error('Error adding role column:', error);
      return res.status(500).json({ 
        error: 'Failed to add role column',
        details: error.message 
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};