-- Create newsletters table
-- Run this in Neon SQL editor

-- Main newsletters table
CREATE TABLE newsletters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT DEFAULT '',
  date TEXT NOT NULL,
  read_online_url TEXT DEFAULT '',
  content TEXT DEFAULT '',
  events JSONB DEFAULT '[]'::jsonb,
  start_date TEXT DEFAULT '',
  end_date TEXT DEFAULT '',
  created_by_device_id TEXT NOT NULL,
  is_published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_newsletters_created_at ON newsletters(created_at DESC);
CREATE INDEX idx_newsletters_published_at ON newsletters(published_at DESC);
CREATE INDEX idx_newsletters_is_published ON newsletters(is_published);
CREATE INDEX idx_newsletters_created_by_device_id ON newsletters(created_by_device_id);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_newsletters_updated_at 
    BEFORE UPDATE ON newsletters 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample newsletters for testing
INSERT INTO newsletters (title, subtitle, date, content, created_by_device_id, is_published, published_at) VALUES
(
  'Welcome to Our Newsletter System',
  'Your weekly digest of events and updates',
  'August 14, 2025',
  '# Welcome!

Welcome to our new newsletter system! Here you''ll find the latest events, updates, and community news.

## What to Expect

• **Weekly Updates**: Get the latest events in your area
• **Event Highlights**: Featured events you won''t want to miss  
• **Community News**: What''s happening in your local community

Stay tuned for more great content!

**[Visit our website](https://example.com)** for more information.',
  'system',
  TRUE,
  NOW()
),
(
  'August Events Roundup',
  'Don''t miss these amazing upcoming events',
  'August 13, 2025',
  '# This Week''s Events

## Music & Entertainment
Check out these amazing musical events happening this week!

## Food & Dining  
New restaurants and food truck events in the area.

More details coming soon...',
  'system',
  FALSE,
  NULL
);