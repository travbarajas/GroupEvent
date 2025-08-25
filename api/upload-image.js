import { IncomingForm } from 'formidable';
import fs from 'fs';
import path from 'path';

// Disable body parser for this API route to handle multipart/form-data
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const form = new IncomingForm({
      uploadDir: './public/uploads/events',
      keepExtensions: true,
      maxFileSize: 5 * 1024 * 1024, // 5MB limit
    });

    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'events');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    form.parse(req, (err, fields, files) => {
      if (err) {
        console.error('Form parsing error:', err);
        return res.status(500).json({ error: 'Failed to parse form data' });
      }

      const imageFile = files.image;
      if (!imageFile) {
        return res.status(400).json({ error: 'No image file provided' });
      }

      // Handle both single file and array of files
      const file = Array.isArray(imageFile) ? imageFile[0] : imageFile;
      
      // Generate unique filename
      const timestamp = Date.now();
      const ext = path.extname(file.originalFilename || '.jpg');
      const filename = `event-${timestamp}${ext}`;
      const newPath = path.join(uploadDir, filename);

      // Move file to final location
      fs.renameSync(file.filepath, newPath);

      // Return the public URL
      const publicUrl = `/uploads/events/${filename}`;
      
      res.status(200).json({ 
        success: true, 
        url: publicUrl,
        filename: filename 
      });
    });

  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}