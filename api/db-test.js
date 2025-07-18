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
    const result = await sql`SELECT 1 as test`;
    
    return res.status(200).json({ 
      success: true, 
      result,
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