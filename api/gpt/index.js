const { neon } = require('@neondatabase/serverless');

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
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('GPT API called with body:', req.body);
    
    const { message, includeEvents = false } = req.body;

    if (!message) {
      console.log('No message provided');
      return res.status(400).json({ 
        error: 'Message is required', 
        success: false 
      });
    }

    console.log('Processing message:', message);
    console.log('Include events:', includeEvents);

    // Build the system message with context
    let systemMessage = `You are LocalAI, a helpful AI assistant for the GroupEvent app, which helps users plan group events and social activities. You can help with event recommendations, restaurant suggestions, activity planning, and general questions about organizing group events.

When displaying events, always format them in this clean, readable style:

📅 [Friendly Date Format - e.g., "Today", "Tomorrow", "Friday, Jan 15"]

[Event Name]
[Description]
[Friendly Time - e.g., "7:00 PM", "2:30 PM"] @ [Venue Name]
Price: [Price/Free]

Group multiple events by date. Use emojis but NO markdown formatting (no ** or other symbols). Make dates and times very user-friendly.`;
    
    // If requested, include event data in context
    if (includeEvents) {
      const events = await getEventsFromDB();
      if (events.length > 0) {
        // Helper function to format date in friendly way
        const formatFriendlyDate = (dateString) => {
          if (!dateString) return 'No Date';
          try {
            const date = new Date(dateString);
            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);
            
            // Reset time for comparison
            today.setHours(0, 0, 0, 0);
            tomorrow.setHours(0, 0, 0, 0);
            date.setHours(0, 0, 0, 0);
            
            if (date.getTime() === today.getTime()) {
              return 'Today';
            } else if (date.getTime() === tomorrow.getTime()) {
              return 'Tomorrow';
            } else {
              return date.toLocaleDateString('en-US', { 
                weekday: 'long', 
                month: 'short', 
                day: 'numeric' 
              });
            }
          } catch {
            return dateString;
          }
        };

        // Helper function to format time in friendly way
        const formatFriendlyTime = (timeString) => {
          if (!timeString) return 'Time TBD';
          try {
            // Handle various time formats
            const time = new Date(`2000-01-01 ${timeString}`);
            return time.toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit',
              hour12: true 
            });
          } catch {
            return timeString;
          }
        };

        // Group events by date for better organization
        const eventsByDate = events.reduce((groups, event) => {
          const friendlyDate = formatFriendlyDate(event.date);
          if (!groups[friendlyDate]) groups[friendlyDate] = [];
          groups[friendlyDate].push(event);
          return groups;
        }, {});

        systemMessage += `\n\nHere are the current events available in our database:\n`;
        
        Object.entries(eventsByDate).forEach(([friendlyDate, dateEvents]) => {
          systemMessage += `\n📅 ${friendlyDate}\n\n`;
          dateEvents.forEach(event => {
            systemMessage += `${event.name || 'Untitled Event'}\n`;
            systemMessage += `${event.description || 'No description'}\n`;
            systemMessage += `${formatFriendlyTime(event.time)}${event.venue_name ? ` @ ${event.venue_name}` : ''}${event.location ? ` (${event.location})` : ''}\n`;
            systemMessage += `Price: ${event.is_free ? 'Free' : (event.price ? `$${event.price}` : 'TBD')}\n`;
            if (event.category) systemMessage += `Category: ${event.category}\n`;
            systemMessage += `\n`;
          });
        });

        systemMessage += `\nWhen responding about events, use this exact clean formatting style - NO markdown symbols like ** or __, just clean text with friendly dates and times. Always group events by date and use emojis to make it visually appealing.`;
      } else {
        systemMessage += `\n\nNo events are currently available in the database, but you can still help with general event planning advice.`;
      }
    }

    // Call OpenAI API directly using fetch
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: message }
        ],
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json().catch(() => ({}));
      console.error('OpenAI API Error:', errorData);
      throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const completion = await openaiResponse.json();
    console.log('OpenAI response received successfully');

    return res.status(200).json({
      response: completion.choices[0].message.content,
      success: true,
      eventsIncluded: includeEvents
    });

  } catch (error) {
    console.error('GPT API Error:', error);
    
    // Check if OpenAI API key is missing
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key is missing from environment variables');
      return res.status(500).json({
        error: 'OpenAI API key is not configured',
        success: false
      });
    }
    
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