const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = neon(process.env.DATABASE_URL);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id SERIAL PRIMARY KEY,
        event_type TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        target_name TEXT,
        source TEXT,
        device_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    // Add columns if they don't exist (for existing tables)
    try { await sql`ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS target_name TEXT`; } catch (e) {}
    try { await sql`ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS source TEXT`; } catch (e) {}
  } catch (e) { /* table may already exist */ }

  try {
    // POST: Log an analytics event
    if (req.method === 'POST') {
      const { event_type, target_type, target_id, target_name, source, device_id } = req.body;

      if (!event_type || !target_type || !target_id) {
        return res.status(400).json({ error: 'event_type, target_type, and target_id are required' });
      }

      await sql`
        INSERT INTO analytics_events (event_type, target_type, target_id, target_name, source, device_id)
        VALUES (${event_type}, ${target_type}, ${target_id}, ${target_name || null}, ${source || null}, ${device_id || null})
      `;

      return res.status(201).json({ success: true });
    }

    // GET: Fetch analytics stats
    if (req.method === 'GET') {
      const { target_type, target_id } = req.query;

      // If specific target requested, return its stats
      if (target_type && target_id) {
        const [stats] = await sql`
          SELECT
            COUNT(*) as total_views,
            COUNT(DISTINCT device_id) as unique_views
          FROM analytics_events
          WHERE target_type = ${target_type}
            AND target_id = ${target_id}
            AND event_type = 'page_view'
        `;

        const [clickStats] = await sql`
          SELECT
            COUNT(*) as total_clicks,
            COUNT(DISTINCT device_id) as unique_clicks
          FROM analytics_events
          WHERE target_type = ${target_type}
            AND target_id = ${target_id}
            AND event_type = 'click'
        `;

        return res.status(200).json({
          target_type,
          target_id,
          views: {
            total: parseInt(stats.total_views),
            unique: parseInt(stats.unique_views),
          },
          clicks: {
            total: parseInt(clickStats.total_clicks),
            unique: parseInt(clickStats.unique_clicks),
          },
        });
      }

      // Otherwise return summary for all target types
      const summary = await sql`
        SELECT
          target_type,
          target_id,
          event_type,
          COUNT(*) as total,
          COUNT(DISTINCT device_id) as unique_count,
          (SELECT target_name FROM analytics_events a2
           WHERE a2.target_type = analytics_events.target_type
             AND a2.target_id = analytics_events.target_id
             AND a2.target_name IS NOT NULL
           ORDER BY a2.id DESC LIMIT 1) as target_name,
          (SELECT source FROM analytics_events a3
           WHERE a3.target_type = analytics_events.target_type
             AND a3.target_id = analytics_events.target_id
             AND a3.source IS NOT NULL
           ORDER BY a3.id DESC LIMIT 1) as latest_source
        FROM analytics_events
        GROUP BY target_type, target_id, event_type
        ORDER BY target_type, total DESC
      `;

      // Group by target_type for easier consumption
      const grouped = {};
      summary.forEach(row => {
        if (!grouped[row.target_type]) {
          grouped[row.target_type] = {};
        }
        if (!grouped[row.target_type][row.target_id]) {
          grouped[row.target_type][row.target_id] = { _name: row.target_name || row.target_id };
        }
        grouped[row.target_type][row.target_id][row.event_type] = {
          total: parseInt(row.total),
          unique: parseInt(row.unique_count),
        };
      });

      // Also get source breakdown for events
      const sourceBreakdown = await sql`
        SELECT
          target_type,
          target_id,
          source,
          COUNT(*) as total,
          COUNT(DISTINCT device_id) as unique_count
        FROM analytics_events
        WHERE source IS NOT NULL
        GROUP BY target_type, target_id, source
        ORDER BY total DESC
      `;

      sourceBreakdown.forEach(row => {
        if (grouped[row.target_type] && grouped[row.target_type][row.target_id]) {
          if (!grouped[row.target_type][row.target_id]._sources) {
            grouped[row.target_type][row.target_id]._sources = {};
          }
          grouped[row.target_type][row.target_id]._sources[row.source] = {
            total: parseInt(row.total),
            unique: parseInt(row.unique_count),
          };
        }
      });

      return res.status(200).json({ analytics: grouped });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in analytics endpoint:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};
