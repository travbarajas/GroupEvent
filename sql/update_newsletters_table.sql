-- Update newsletters table to support block-based content
-- Run this in Neon SQL editor

-- Add blocks column to store block-based content
ALTER TABLE newsletters 
ADD COLUMN IF NOT EXISTS blocks JSONB DEFAULT '[]'::jsonb;

-- Create index for better query performance on blocks
CREATE INDEX IF NOT EXISTS idx_newsletters_blocks ON newsletters USING GIN (blocks);

-- Update existing newsletters to have empty blocks array if needed
UPDATE newsletters 
SET blocks = '[]'::jsonb 
WHERE blocks IS NULL;

-- Add some example block-based content for testing
INSERT INTO newsletters (
  title, 
  subtitle, 
  date, 
  content, 
  blocks,
  created_by_device_id, 
  is_published, 
  published_at
) VALUES (
  'Block-Based Newsletter Example',
  'Demonstrating the new block editor',
  'August 14, 2025',
  '# Welcome to Block Editor

This is a paragraph block with some content.

## Features

Here are the new features:
• Drag and drop blocks
• Multiple heading levels
• Image blocks
• Button blocks
• Content breaks

---

Try the new editor today!',
  '[
    {
      "id": "h1-1723680000-abc123",
      "type": "heading-1", 
      "order": 0,
      "content": "Welcome to Block Editor",
      "alignment": "center"
    },
    {
      "id": "p-1723680001-def456",
      "type": "paragraph",
      "order": 1, 
      "content": "This is a paragraph block with some content.",
      "alignment": "left"
    },
    {
      "id": "h2-1723680002-ghi789",
      "type": "heading-2",
      "order": 2,
      "content": "Features", 
      "alignment": "left"
    },
    {
      "id": "p-1723680003-jkl012",
      "type": "paragraph",
      "order": 3,
      "content": "Here are the new features:\n• Drag and drop blocks\n• Multiple heading levels\n• Image blocks\n• Button blocks\n• Content breaks",
      "alignment": "left"
    },
    {
      "id": "break-1723680004-mno345",
      "type": "content-break",
      "order": 4,
      "style": "line"
    },
    {
      "id": "btn-1723680005-pqr678", 
      "type": "button",
      "order": 5,
      "text": "Try the new editor today!",
      "url": "https://example.com",
      "style": "primary",
      "alignment": "center"
    }
  ]'::jsonb,
  'system',
  TRUE,
  NOW()
) ON CONFLICT DO NOTHING;