const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // Get all invites to see what's in the table
    const allInvites = await sql`SELECT * FROM invites`;
    
    // Get all groups to see what's in the table
    const allGroups = await sql`SELECT * FROM groups`;
    
    return res.status(200).json({
      success: true,
      invites: allInvites,
      groups: allGroups,
      message: 'Database content check'
    });
  } catch (error) {
    console.error('Error checking database:', error);
    return res.status(500).json({ 
      error: 'Failed to check database',
      details: error.message
    });
  }
};