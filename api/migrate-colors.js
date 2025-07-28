const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

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
      console.log('🚀 Starting color column migration...');
      
      // Add color column to members table
      await sql`
        ALTER TABLE members 
        ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#60a5fa'
      `;
      
      console.log('✅ Color column added successfully');
      
      // Check current members table structure
      const tableInfo = await sql`
        SELECT column_name, data_type, column_default 
        FROM information_schema.columns 
        WHERE table_name = 'members'
        ORDER BY ordinal_position
      `;
      
      console.log('📊 Current members table structure:', tableInfo);
      
      return res.status(200).json({ 
        success: true, 
        message: 'Color column migration completed',
        tableStructure: tableInfo
      });
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
      return res.status(500).json({ 
        error: 'Migration failed', 
        details: error.message 
      });
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
};