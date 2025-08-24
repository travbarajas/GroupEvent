const { neon } = require('@neondatabase/serverless');
const axios = require('axios');

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

// Google Places API functions
async function searchNearbyPlaces(location, query, radius = 5000) {
  try {
    if (!process.env.GOOGLE_PLACES_API_KEY) {
      console.log('Google Places API key not configured');
      return [];
    }

    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/nearbysearch/json',
      {
        params: {
          location: `${location.latitude},${location.longitude}`,
          radius: radius,
          keyword: query,
          key: process.env.GOOGLE_PLACES_API_KEY,
        },
        timeout: 5000
      }
    );
    
    return response.data.results.slice(0, 5); // Return top 5 results to manage tokens
  } catch (error) {
    console.error('Error fetching places:', error);
    return [];
  }
}

async function searchPlacesByText(query, location) {
  try {
    if (!process.env.GOOGLE_PLACES_API_KEY) {
      console.log('Google Places API key not configured');
      return [];
    }

    let params = {
      query: query,
      key: process.env.GOOGLE_PLACES_API_KEY,
    };
    
    if (location) {
      params.location = `${location.latitude},${location.longitude}`;
      params.radius = 10000; // 10km radius for text search
    }
    
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/textsearch/json',
      { params, timeout: 5000 }
    );
    
    return response.data.results.slice(0, 5);
  } catch (error) {
    console.error('Error searching places by text:', error);
    return [];
  }
}

function determinePlaceType(query) {
  const queryLower = query.toLowerCase();
  
  const placeTypeMap = {
    restaurant: ['restaurant', 'food'],
    cafe: ['cafe', 'coffee_shop'],
    bar: ['bar', 'night_club'],
    shopping: ['shopping_mall', 'store'],
    entertainment: ['movie_theater', 'amusement_park', 'bowling_alley'],
    gym: ['gym', 'fitness_center'],
    park: ['park', 'playground'],
  };
  
  for (const [key, types] of Object.entries(placeTypeMap)) {
    if (queryLower.includes(key)) {
      return types;
    }
  }
  
  return ['establishment']; // Default fallback
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
    console.log('GPT API called with body:', JSON.stringify(req.body, null, 2));
    
    const { 
      message, 
      includeEvents = true, // Always true now as per previous changes
      location,
      enablePlaces = true 
    } = req.body;
    
    console.log('Location data received:', location);
    console.log('Enable places:', enablePlaces);

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

When displaying places/restaurants, use this format:

🍽️ [Place Name]
⭐ [Rating]/5 stars
📍 [Address]
💰 [Price Level: $ to $$$$]
🕐 [Open/Closed status if available]

Group multiple events by date. Use emojis but NO markdown formatting (no ** or other symbols). Make dates and times very user-friendly.`;

    // Add Places API instructions based on location availability
    if (enablePlaces) {
      if (location && location.latitude && location.longitude) {
        systemMessage += `\n\nYou have access to Google Places data and the user's current location (${location.latitude}, ${location.longitude}). When users ask about places, restaurants, or venues, you should:
1. Identify what type of place they're looking for
2. Use the available place data to provide recommendations
3. Include relevant details like ratings, address, and pricing level
4. Suggest places that would be good for group events when relevant
5. Mention that these are nearby recommendations based on their location`;
      } else {
        systemMessage += `\n\nYou have Google Places API access but no location data from the user. If they ask about nearby places, let them know you need their location permission to provide personalized recommendations, but you can still help with general place suggestions.`;
      }
    }
    
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

    // Handle Google Places API requests
    let placesData = [];
    const isAskingAboutPlaces = /restaurant|food|eat|cafe|coffee|bar|venue|place|nearby|around here|close by|dining|lunch|dinner|brunch/i.test(message);
    
    console.log('Place query analysis:');
    console.log('- Is asking about places:', isAskingAboutPlaces);
    console.log('- Places enabled:', enablePlaces);
    console.log('- Has location:', !!(location && location.latitude && location.longitude));
    
    if (isAskingAboutPlaces && enablePlaces && location && location.latitude && location.longitude) {
      console.log('User is asking about places, searching Google Places API...');
      
      // Extract the type of place from the message
      const placeQuery = message.toLowerCase()
        .replace(/where|what|find|show|recommend|suggest|good|best|near|nearby|close/gi, '')
        .replace(/\?|!|\.|,/g, '')
        .trim();
      
      // Search for places using text search (more flexible than nearby search)
      placesData = await searchPlacesByText(placeQuery, location);
      
      if (placesData.length > 0) {
        // Format places data for GPT
        const formattedPlaces = placesData.map((place) => ({
          name: place.name,
          rating: place.rating || 'No rating',
          address: place.formatted_address || place.vicinity || 'Address not available',
          priceLevel: place.price_level ? '$'.repeat(place.price_level) : 'Price not available',
          isOpen: place.opening_hours?.open_now !== undefined ? 
            (place.opening_hours.open_now ? 'Open now' : 'Closed now') : 'Hours unknown',
          types: place.types?.slice(0, 3).join(', ') || 'General establishment',
        }));
        
        systemMessage += `\n\nNearby places matching "${placeQuery}":\n${JSON.stringify(formattedPlaces, null, 2)}`;
        systemMessage += `\n\nUse this information to provide specific recommendations with names, ratings, addresses, and why each place would be good for their needs. Format them using the place format specified above.`;
        
        console.log(`Found ${placesData.length} places for query: ${placeQuery}`);
      } else {
        console.log('No places found or API error - user has location but no results');
        systemMessage += `\n\nNote: User asked about places and has location enabled, but no place data was retrieved. This might be due to API key issues or no results for their query.`;
      }
    } else if (isAskingAboutPlaces && enablePlaces) {
      console.log('User asking about places but location not available');
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
      eventsIncluded: includeEvents,
      placesIncluded: placesData.length > 0,
      placesCount: placesData.length
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