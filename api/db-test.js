const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  try {
    console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
    console.log('DATABASE_URL length:', process.env.DATABASE_URL ? process.env.DATABASE_URL.length : 0);
    
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ 
        error: 'DATABASE_URL not found',
        envVars: Object.keys(process.env).filter(key => key.includes('DATABASE') || key.includes('POSTGRES'))
      });
    }

    const sql = neon(process.env.DATABASE_URL);
    
    // Test simple query
    const basicTest = await sql`SELECT 1 as test`;
    
    // Test if our tables exist
    const tablesTest = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('groups', 'invites')
    `;
    
    // Test invites table structure too
    let invitesColumns = null;
    try {
      invitesColumns = await sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'invites'
      `;
    } catch (e) {
      invitesColumns = { error: e.message };
    }
    
    // Test groups table structure
    let groupsColumns = null;
    try {
      groupsColumns = await sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'groups'
      `;
    } catch (e) {
      groupsColumns = { error: e.message };
    }
    
    return res.status(200).json({ 
      success: true, 
      basicTest,
      tablesExist: tablesTest,
      groupsColumns,
      invitesColumns,
      message: 'Database connection working!'
    });
  } catch (error) {
    console.error('Database test error:', error);
    return res.status(500).json({ 
      error: 'Database connection failed',
      details: error.message,
      type: error.constructor.name
    });
  }
};