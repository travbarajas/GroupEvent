const OpenAI = require('openai');
const { neon } = require('@neondatabase/serverless');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize database connection
const sql = neon(process.env.DATABASE_URL);

// Function to fetch events from your database
async function getEventsFromDB() {
  try {
    // Fetch events from your global events table using the correct schema
    const events = await sql`
      SELECT 
        id, 
        name, 
        description, 
        date, 
        time, 
        venue_name, 
        location, 
        price, 
        currency,
        is_free,
        category,
        tags
      FROM events 
      WHERE date >= CURRENT_DATE 
      ORDER BY date ASC 
      LIMIT 25
    `;
    
    return events;
  } catch (error) {
    console.error('Error fetching events from database:', error);
    return [];
  }
}

// Main API handler
module.exports = async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, includeEvents = false } = req.body;

    if (!message) {
      return res.status(400).json({ 
        error: 'Message is required', 
        success: false 
      });
    }

    // Build the system message with context
    let systemMessage = `You are a helpful AI assistant for the GroupEvent app, which helps users plan group events and social activities. You can help with event recommendations, restaurant suggestions, activity planning, and general questions about organizing group events.`;
    
    // If requested, include event data in context
    if (includeEvents) {
      const events = await getEventsFromDB();
      if (events.length > 0) {
        systemMessage += `\n\nHere are the current events available in our database:\n${JSON.stringify(events, null, 2)}`;
        systemMessage += `\n\nUse this event information to provide relevant recommendations and answers about available events, venues, and activities. When suggesting events, include details like date, time, location, and price when available.`;
      } else {
        systemMessage += `\n\nNo events are currently available in the database, but you can still help with general event planning advice.`;
      }
    }

    // Call GPT-4o-mini
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: message }
      ],
      temperature: 0.7,
      max_tokens: 800, // Adjust based on your needs
    });

    return res.status(200).json({
      response: completion.choices[0].message.content,
      success: true,
      eventsIncluded: includeEvents
    });

  } catch (error) {
    console.error('GPT API Error:', error);
    
    // Handle specific OpenAI API errors
    if (error.status === 401) {
      return res.status(500).json({
        error: 'OpenAI API key is invalid or missing',
        success: false
      });
    }
    
    if (error.status === 429) {
      return res.status(429).json({
        error: 'Rate limit exceeded. Please try again later.',
        success: false
      });
    }

    return res.status(500).json({
      error: 'Failed to get response from GPT',
      success: false,
      details: error.message
    });
  }
}