import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Alert,
  TouchableWithoutFeedback,
  Keyboard,
  Animated,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/useThemeColor';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import EventBlock from './EventBlock';
import PlaceBlock from './PlaceBlock';

interface EventData {
  id?: string;
  name: string;
  description?: string;
  date: string;
  time?: string;
  price?: number | string;
  is_free?: boolean;
  location?: string;
  venue_name?: string;
  image_url?: string;
}

interface PlaceData {
  id?: string;
  name: string;
  type?: string; // restaurant, cafe, shop, attraction, etc.
  cuisine?: string;
  rating?: number;
  price_level?: string;
  address?: string;
  phone?: string;
  description?: string;
  image_url?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  events?: EventData[];
  places?: PlaceData[];
}

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
}

// Function to parse events and places from AI response and clean text
const parseContentFromResponse = (responseText: string, apiEvents?: any[], apiPlaces?: any[], hasApiData?: boolean): { events: EventData[], places: PlaceData[], cleanedText: string } => {
  const events: EventData[] = [];
  const places: PlaceData[] = [];
  let cleanedText = responseText;

  // Check if we have ANY API data that should force custom blocks
  const hasAnyApiData = hasApiData || 
    (apiEvents && Array.isArray(apiEvents) && apiEvents.length > 0) ||
    (apiPlaces && Array.isArray(apiPlaces) && apiPlaces.length > 0);
  
  // Parse structured events data from API - ALWAYS create blocks for API data
  if (apiEvents && Array.isArray(apiEvents) && apiEvents.length > 0) {
    console.log('Processing API events data:', apiEvents);
    apiEvents.forEach(event => {
      if (event && typeof event === 'object') {
        const eventData = {
          id: event.id || Math.random().toString(),
          name: event.name || event.title || 'Event',
          description: event.description || event.summary || '',
          date: event.date || event.start_date || event.when || '',
          time: event.time || event.start_time || '',
          price: event.price || event.cost,
          is_free: event.is_free || event.free || false,
          location: event.location || event.address || event.venue || '',
          venue_name: event.venue_name || event.venue || '',
          image_url: event.image_url || event.image || '',
        };
        console.log('Adding API event:', eventData);
        events.push(eventData);
      }
    });
    console.log(`Added ${events.length} events from API data`);
  }
  
  // Parse structured place data from API (restaurants, shops, attractions, etc.) - ALWAYS create blocks for API data
  if (apiPlaces && Array.isArray(apiPlaces) && apiPlaces.length > 0) {
    console.log('Processing API places data:', apiPlaces);
    apiPlaces.forEach(place => {
      if (place && typeof place === 'object') {
        const placeData = {
          id: place.id || Math.random().toString(),
          name: place.name || 'Place',
          type: place.type || place.category || 'Place',
          cuisine: place.cuisine || '',
          rating: place.rating || place.score,
          price_level: place.price_level || place.priceLevel || place.price,
          address: place.address || place.location || '',
          phone: place.phone || place.phoneNumber || '',
          description: place.description || place.summary || '',
          image_url: place.image_url || place.image || '',
        };
        console.log('Adding API place:', placeData);
        places.push(placeData);
      }
    });
    console.log(`Added ${places.length} places from API data`);
  }

  // Also try to parse events and places from text patterns (for when API doesn't return structured data)
  // But be more careful to avoid false positives like recipes
  // If we have API data, be MORE aggressive in parsing text to ensure we show blocks
  
  // Parse places from text - look for any business/location patterns
  let placePatterns = [
    // Pattern: "1. Place Name - Description" (numbered list format)
    /^\d+\.\s*\*?\*?([^-\n]+?)\*?\*?\s*-\s*([^-\n]+)/gmi,
    // Pattern: "**Place Name** - Description"  
    /\*\*([^*]+)\*\*\s*-\s*([^-\n]+)/gi,
    // Pattern: "• Place Name - Description" (bullet points)
    /^[•\-*]\s*\*?\*?([^-\n]+?)\*?\*?\s*-\s*([^-\n]+)/gmi,
    // Pattern: Just numbered place names (fallback)
    /^\d+\.\s*\*?\*?([^-\n]+?)\*?\*?\s*$/gmi,
    // Pattern: Just bullet point place names (fallback)
    /^[•\-*]\s*\*?\*?([^-\n]+?)\*?\*?\s*$/gmi,
  ];

  // If we have API data, add more aggressive patterns to catch everything
  if (hasAnyApiData) {
    console.log('API data detected - using aggressive parsing patterns');
    placePatterns = placePatterns.concat([
      // More aggressive patterns when API data is present
      /^([^-\n]+?)\s*-\s*([^-\n]+)$/gmi, // Any line with " - " 
      /^\d+\.\s*([^-\n]+)$/gmi, // Any numbered item
      /^[•\-*]\s*([^-\n]+)$/gmi, // Any bulleted item
    ]);
  }

  console.log('Parsing places from response:', responseText);
  
  placePatterns.forEach((pattern, patternIndex) => {
    let match;
    while ((match = pattern.exec(responseText)) !== null) {
      const fullMatch = match[0];
      let name = match[1]?.trim();
      let description = match[2]?.trim() || '';
      
      console.log(`Pattern ${patternIndex} matched:`, { fullMatch, name, description });
      
      // Skip if this looks like a recipe, event, or instruction
      if (fullMatch.toLowerCase().includes('ingredient') || 
          fullMatch.toLowerCase().includes('recipe') ||
          fullMatch.toLowerCase().includes('step') ||
          fullMatch.toLowerCase().includes('cook') ||
          fullMatch.toLowerCase().includes('bake') ||
          fullMatch.toLowerCase().includes('event') ||
          fullMatch.toLowerCase().includes('date:') ||
          fullMatch.toLowerCase().includes('time:')) {
        console.log('Skipping non-place content:', fullMatch);
        continue;
      }

      // Determine place type from description
      let placeType = 'Place';
      const lowerDesc = (fullMatch + ' ' + description).toLowerCase();
      if (lowerDesc.includes('restaurant') || lowerDesc.includes('dining') || lowerDesc.includes('cuisine')) placeType = 'Restaurant';
      else if (lowerDesc.includes('cafe') || lowerDesc.includes('coffee')) placeType = 'Cafe';
      else if (lowerDesc.includes('shop') || lowerDesc.includes('store') || lowerDesc.includes('boutique')) placeType = 'Shop';
      else if (lowerDesc.includes('bar') || lowerDesc.includes('pub') || lowerDesc.includes('brewery')) placeType = 'Bar';
      else if (lowerDesc.includes('hotel') || lowerDesc.includes('motel') || lowerDesc.includes('inn')) placeType = 'Hotel';
      else if (lowerDesc.includes('park') || lowerDesc.includes('garden') || lowerDesc.includes('trail')) placeType = 'Park';
      else if (lowerDesc.includes('museum') || lowerDesc.includes('gallery') || lowerDesc.includes('attraction')) placeType = 'Attraction';
      else if (lowerDesc.includes('gym') || lowerDesc.includes('fitness') || lowerDesc.includes('spa')) placeType = 'Fitness';

      // Extract rating if present
      let rating = undefined;
      const ratingMatch = fullMatch.match(/(\d+\.\d+)(?:\s*(?:stars?|\/5|rating))?|\b(\d+)\/5\b|(\d+)\s*(?:stars?)/i);
      if (ratingMatch) {
        rating = parseFloat(ratingMatch[1] || ratingMatch[2] || ratingMatch[3]);
        if (rating > 5) rating = rating / 2; // Convert 10-point to 5-point scale
      }

      // Extract price level
      let priceLevel = '';
      const priceMatch = fullMatch.match(/(\$+)|(?:budget|cheap|inexpensive)|(?:mid-range|moderate)|(?:expensive|upscale|fine dining)/i);
      if (priceMatch) {
        if (priceMatch[1]) priceLevel = priceMatch[1];
        else if (priceMatch[0].toLowerCase().includes('budget') || priceMatch[0].toLowerCase().includes('cheap')) priceLevel = '$';
        else if (priceMatch[0].toLowerCase().includes('mid') || priceMatch[0].toLowerCase().includes('moderate')) priceLevel = '$$';
        else if (priceMatch[0].toLowerCase().includes('expensive') || priceMatch[0].toLowerCase().includes('upscale')) priceLevel = '$$$';
      }

      if (name && name.length > 2) {
        const place = {
          id: Math.random().toString(),
          name: name,
          type: placeType,
          cuisine: placeType === 'Restaurant' ? description : '',
          rating: rating,
          price_level: priceLevel,
          address: '',
          phone: '',
          description: description,
          image_url: '',
        };
        
        console.log('Adding place:', place);
        places.push(place);
        
        // Remove from text
        cleanedText = cleanedText.replace(fullMatch, '').trim();
      }
    }
  });
  
  // Parse events from text - only if it looks like actual events (has date/time/location context)
  const eventPatterns = [
    // Calendar emoji format with date
    /📅\s*([^\n]+)\n\n([\s\S]*?)(?=\n\n📅|\n\n$|$)/gi,
    // Event: format with clear event indicators
    /(?:Event|EVENT):\s*([^\n]+)(?:\n.*?(?:Date|DATE|When):\s*([^\n]+))?(?:\n.*?(?:Time|TIME):\s*([^\n]+))?(?:\n.*?(?:Location|LOCATION|Where):\s*([^\n]+))?/gi,
  ];
  
  eventPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(responseText)) !== null) {
      const fullMatch = match[0];
      let name, date, time, location = '';
      
      // Skip if this looks like a recipe or instruction
      if (fullMatch.toLowerCase().includes('ingredient') || 
          fullMatch.toLowerCase().includes('recipe') ||
          fullMatch.toLowerCase().includes('step') ||
          fullMatch.toLowerCase().includes('cook') ||
          fullMatch.toLowerCase().includes('bake')) {
        continue;
      }
      
      if (pattern === eventPatterns[0]) { // Calendar emoji format
        const [, eventDate, content] = match;
        const lines = content.split('\n').map(line => line.trim()).filter(line => line);
        date = eventDate?.trim();
        name = lines[0] || '';
        
        // Look for time and location
        const timeLocationLine = lines.find(line => line.includes('@') && (line.includes('PM') || line.includes('AM')));
        if (timeLocationLine) {
          const timeMatch = timeLocationLine.match(/^([^@]+)/);
          time = timeMatch ? timeMatch[1].trim() : '';
          const venueMatch = timeLocationLine.match(/@\s*([^(]+)/);
          location = venueMatch ? venueMatch[1].trim() : '';
        }
      } else if (pattern === eventPatterns[1]) { // Event: format
        [, name, date, time, location] = match;
      }
      
      // Only add if it has event-like characteristics
      if (name && name.trim() && (date || time || location)) {
        events.push({
          id: Math.random().toString(),
          name: name.trim(),
          description: '',
          date: date?.trim() || '',
          time: time?.trim() || '',
          price: '',
          is_free: false,
          location: location?.trim() || '',
          venue_name: '',
          image_url: '',
        });
        
        // Remove from text
        cleanedText = cleanedText.replace(fullMatch, '').trim();
      }
    }
  });
  
  // Generate summary message
  const totalItems = events.length + places.length;
  
  // Special handling: If we have API data but no parsed items, force create items from text
  if (hasAnyApiData && totalItems === 0) {
    console.log('API data present but no items parsed - forcing text parsing');
    // Split response into lines and create place items from any substantial lines
    const lines = responseText.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 5 && !line.toLowerCase().includes('here are') && !line.toLowerCase().includes('i found'));
    
    lines.forEach((line, index) => {
      if (index < 10 && line.length > 5) { // Limit to first 10 items
        places.push({
          id: Math.random().toString(),
          name: line.replace(/^\d+\.\s*/, '').replace(/^[•\-*]\s*/, ''), // Remove numbering/bullets
          type: 'Place',
          cuisine: '',
          rating: undefined,
          price_level: '',
          address: '',
          phone: '',
          description: line,
          image_url: '',
        });
      }
    });
    console.log(`Force-created ${places.length} place items from API response text`);
  }
  
  const finalTotalItems = events.length + places.length;
  if (finalTotalItems > 0) {
    let message = '';
    if (events.length > 0) {
      message += events.length === 1 ? `I found 1 event` : `I found ${events.length} events`;
    }
    if (places.length > 0) {
      if (events.length > 0) message += ' and ';
      message += places.length === 1 ? `1 place` : `${places.length} places`;
    }
    message += ' for you:';
    cleanedText = message;
  }
  
  return { events, places, cleanedText };
};

export default function GPTChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<LocationData | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [isWatchingLocation, setIsWatchingLocation] = useState<boolean>(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState<boolean>(false);
  const [selectedLocationOption, setSelectedLocationOption] = useState<string>('Roseville');
  
  // Animation values for keyboard
  const keyboardOffset = useRef(new Animated.Value(0)).current;

  // City options and their coordinates
  const locationOptions = [
    'Use Location',
    'Roseville',
    'Rocklin', 
    'Lincoln'
  ];

  // Coordinates for preset cities (center points)
  const cityCoordinates = {
    'Roseville': { latitude: 38.7521, longitude: -121.2880 },
    'Rocklin': { latitude: 38.7907, longitude: -121.2357 },
    'Lincoln': { latitude: 38.8916, longitude: -121.2930 }
  };

  const backgroundColor = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');
  const iconColor = useThemeColor({}, 'icon');

  // Animation functions
  const animateUp = () => {
    Animated.timing(keyboardOffset, {
      toValue: -150, // Move content up by 150px
      duration: 300, // Fixed smooth duration
      useNativeDriver: true, // Use native driver for better performance
    }).start();
  };

  const animateDown = () => {
    Animated.timing(keyboardOffset, {
      toValue: 0, // Move content back to original position
      duration: 300, // Fixed smooth duration
      useNativeDriver: true, // Use native driver for better performance
    }).start();
  };

  // Handle input focus - trigger animation immediately
  const handleInputFocus = () => {
    animateUp();
  };

  // Handle screen tap to dismiss keyboard - trigger animation immediately
  const handleScreenTap = () => {
    Keyboard.dismiss();
    animateDown();
  };

  // Handle location option selection
  const handleLocationOptionSelect = async (option: string) => {
    setShowLocationDropdown(false);
    
    if (option === 'Use Location') {
      // Request location permission and get current location
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Location Permission Denied', 
            'Location permission was denied. Switching to Roseville as default location.',
            [
              {
                text: 'OK',
                onPress: () => {
                  setSelectedLocationOption('Roseville');
                  setUserLocation(null);
                  setLocationPermission(false);
                  setIsWatchingLocation(false);
                }
              }
            ]
          );
          return;
        }
        
        setSelectedLocationOption(option);
        setLocationPermission(true);
        await getCurrentLocation();
      } catch (error) {
        console.error('Error requesting location permission:', error);
        // Revert to Roseville on error
        setSelectedLocationOption('Roseville');
        setLocationPermission(false);
        setUserLocation(null);
        setIsWatchingLocation(false);
      }
    } else {
      // Using a preset city
      setSelectedLocationOption(option);
      setUserLocation(null);
      setLocationPermission(false);
      setIsWatchingLocation(false);
    }
  };

  // Function to get current GPS location
  const getCurrentLocation = async () => {
    try {
      let location;
      
      try {
        // First try: Most aggressive GPS settings
        console.log('Attempting high-precision GPS location...');
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
          maximumAge: 5000,
          timeout: 25000,
        });
      } catch (error) {
        console.log('High precision failed, trying high accuracy:', error);
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          maximumAge: 10000,
          timeout: 20000,
        });
      }
      
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        timestamp: location.timestamp,
      });

      console.log('Location obtained:', location.coords);
      
      // Start watching location for continuous updates if accuracy is poor
      if (location.coords.accuracy > 500) {
        console.log('Starting location watch for better accuracy...');
        startLocationWatch();
      }
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Location Error', 'Could not get current location. Please try again.');
    }
  };

  // Initialize with default location option
  useEffect(() => {
    // Don't automatically request location on mount anymore
    // Let user choose via dropdown
  }, []);

  // Function to start continuous location watching
  const startLocationWatch = async () => {
    if (isWatchingLocation) return;
    
    try {
      setIsWatchingLocation(true);
      console.log('Starting continuous location watch...');
      
      await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 5000, // Update every 5 seconds
          distanceInterval: 10, // Update if moved 10 meters
        },
        (location) => {
          console.log('Location watch update:');
          console.log('- Accuracy:', location.coords.accuracy, 'meters');
          console.log('- Coordinates:', location.coords.latitude, location.coords.longitude);
          
          // Only update if we got better accuracy
          if (!userLocation || location.coords.accuracy < (userLocation.accuracy || Infinity)) {
            setUserLocation({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              accuracy: location.coords.accuracy,
              timestamp: location.timestamp,
            });
            console.log('Updated to better location accuracy:', location.coords.accuracy);
            
            // Stop watching once we get good accuracy
            if (location.coords.accuracy < 100) {
              console.log('Good accuracy achieved, stopping location watch');
              setIsWatchingLocation(false);
            }
          }
        }
      );
    } catch (error) {
      console.error('Error starting location watch:', error);
      setIsWatchingLocation(false);
    }
  };

  // Function to refresh location manually
  const refreshLocation = async () => {
    try {
      console.log('Refreshing location...');
      let location;
      
      try {
        // Try most aggressive settings first
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
          maximumAge: 0, // Force fresh location
          timeout: 30000, // Wait up to 30 seconds
        });
      } catch (error) {
        console.log('Best navigation failed, trying high accuracy:', error);
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          maximumAge: 0,
          timeout: 25000,
        });
      }
      
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        timestamp: location.timestamp,
      });

      console.log('Location refreshed:');
      console.log('- Latitude:', location.coords.latitude);
      console.log('- Longitude:', location.coords.longitude);
      console.log('- Accuracy:', location.coords.accuracy, 'meters');
      
      Alert.alert(
        'Location Updated', 
        `New location accuracy: ±${Math.round(location.coords.accuracy || 0)} meters`
      );
    } catch (error) {
      console.error('Error refreshing location:', error);
      Alert.alert('Location Error', 'Could not refresh location. Please check your location settings.');
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage = inputText.trim();
    setInputText('');
    
    // Determine location data to send
    let locationData = null;
    if (selectedLocationOption === 'Use Location' && userLocation) {
      // Use actual GPS coordinates
      locationData = userLocation;
    } else if (selectedLocationOption !== 'Use Location') {
      // Use preset city coordinates instead of just city name
      const cityCoords = cityCoordinates[selectedLocationOption];
      if (cityCoords) {
        locationData = {
          latitude: cityCoords.latitude,
          longitude: cityCoords.longitude,
          city: selectedLocationOption, // Also include city name for context
          accuracy: 100, // Preset accuracy for city center
        };
      }
    }
    
    // Add user message immediately
    const newUserMessage: Message = {
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    };
    const updatedMessages = [...messages, newUserMessage];
    setMessages(updatedMessages);
    setLoading(true);

    // Get last 12 messages for context (including the new user message)
    const recentMessages = updatedMessages.slice(-12).map(msg => ({
      role: msg.role,
      content: msg.content,
      // Don't include events/places in the context to keep it clean
    }));
    
    console.log('Sending message with location:', locationData);
    console.log('Recent messages for context:', recentMessages);

    try {
      console.log('Sending request with data:', {
        message: userMessage,
        context: recentMessages,
        includeEvents: true,
        location: locationData,
        enablePlaces: true,
      });

      const response = await fetch('https://group-event.vercel.app/api/gpt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          context: recentMessages,
          messages: recentMessages, // Also send as 'messages' in case API expects this key
          conversation_history: recentMessages, // Another possible key name
          includeEvents: true,
          location: locationData,
          enablePlaces: true,
        }),
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);

      // Check if response is OK first
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        
        const errorMessage: Message = {
          role: 'assistant',
          content: `API Error (${response.status}): ${errorText.includes('<!DOCTYPE') ? 'Server returned HTML error page' : errorText}`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
        return;
      }

      // Try to parse JSON
      const responseText = await response.text();
      console.log('Raw response:', responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        console.error('Raw response that failed to parse:', responseText);
        
        const errorMessage: Message = {
          role: 'assistant',
          content: `Failed to parse response. Server returned: ${responseText.substring(0, 200)}...`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
        return;
      }
      
      if (data.success) {
        console.log('API Response data:', data);
        console.log('Raw response text:', data.response);
        console.log('API events data:', data.events);
        console.log('API places data:', data.restaurants || data.places);
        
        // Check if we have ANY structured data from Google Places or similar APIs
        const hasApiData = !!(data.events || data.restaurants || data.places || 
                             data.google_places || data.yelp_data || data.structured_data);
        console.log('Has API data:', hasApiData);
        
        // Parse events and places from the response and get cleaned text
        const { events, places, cleanedText } = parseContentFromResponse(
          data.response, 
          data.events, 
          data.restaurants || data.places, 
          hasApiData
        );
        
        console.log('Parsed events:', events);
        console.log('Parsed places:', places);
        console.log('Cleaned text:', cleanedText);
        
        const assistantMessage: Message = {
          role: 'assistant',
          content: cleanedText,
          timestamp: new Date(),
          events: events.length > 0 ? events : undefined,
          places: places.length > 0 ? places : undefined,
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        const errorMessage: Message = {
          role: 'assistant',
          content: `Sorry, I encountered an error: ${data.error || 'Unknown error'}. Please try again.`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: `Network error: ${error.message}. Please check your connection and try again.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    Alert.alert(
      'Clear Chat',
      'Are you sure you want to clear all messages?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => setMessages([]) },
      ]
    );
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      {/* Show header only when there are messages */}
      {messages.length > 0 && (
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Ionicons name="sparkles" size={24} color={tintColor} />
            <Text style={[styles.title, { color: textColor }]}>LocalAI</Text>
          </View>
          
          <View style={styles.headerControls}>
            <TouchableOpacity 
              onPress={() => setShowLocationDropdown(true)} 
              style={styles.locationDropdownButton}
            >
              <Ionicons 
                name="location" 
                size={16} 
                color={tintColor} 
              />
              <Text style={[styles.locationDropdownText, { color: textColor }]}>
                {selectedLocationOption}
              </Text>
              <Ionicons 
                name="chevron-down" 
                size={16} 
                color={textColor} 
              />
            </TouchableOpacity>
            
            <TouchableOpacity onPress={clearChat} style={styles.clearButton}>
              <Ionicons name="trash-outline" size={20} color={tintColor} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {messages.length === 0 ? (
        // Centered layout when no messages
        <TouchableWithoutFeedback onPress={handleScreenTap}>
          <View style={styles.centeredContainer}>
            <Animated.View style={[
              styles.centeredInputContainer,
              { transform: [{ translateY: keyboardOffset }] }
            ]}>
              {/* Title and subtitle above input */}
              <TouchableWithoutFeedback onPress={handleScreenTap}>
                <View style={styles.centeredContent}>
                  <Ionicons name="sparkles" size={48} color={tintColor} />
                  <Text style={[styles.centeredTitle, { color: textColor }]}>LocalAI</Text>
                  <Text style={styles.centeredSubtitle}>
                    Ask me about local events, restaurants, or help with group planning
                  </Text>
                </View>
              </TouchableWithoutFeedback>
              
              {/* Centered Input */}
              <View style={styles.centeredInputRow}>
                <View style={styles.centeredInputField}>
                  <TextInput
                    style={[styles.centeredInput, { color: textColor }]}
                    value={inputText}
                    onChangeText={setInputText}
                    placeholder="Ask me anything..."
                    placeholderTextColor="#999"
                    multiline={false}
                    onSubmitEditing={sendMessage}
                    onFocus={handleInputFocus}
                    autoFocus={false}
                  />
                </View>
                <TouchableOpacity 
                  style={[
                    styles.centeredSendButton,
                    { backgroundColor: inputText.trim() && !loading ? '#007AFF' : '#666666' }
                  ]}
                  onPress={sendMessage}
                  disabled={!inputText.trim() || loading}
                >
                  <Ionicons 
                    name={loading ? "hourglass-outline" : "send"} 
                    size={20} 
                    color="white" 
                  />
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </TouchableWithoutFeedback>
      ) : (
        // Normal chat layout when messages exist
        <>
          <ScrollView 
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
          >
            {messages.map((msg, index) => (
              <View key={index}>
                {/* Regular message bubble */}
                <View 
                  style={[
                    styles.messageBubble,
                    msg.role === 'user' ? styles.userMessage : {
                      alignSelf: 'flex-start',
                      backgroundColor: backgroundColor,
                      borderWidth: 1,
                      borderColor: '#666666',
                    }
                  ]}
                >
                  <Text style={[
                    styles.messageText,
                    msg.role === 'user' ? styles.userMessageText : { color: '#ffffff' }
                  ]}>
                    {msg.content}
                  </Text>
                  <Text style={[
                    styles.timestamp,
                    msg.role === 'user' ? styles.userTimestamp : styles.assistantTimestamp
                  ]}>
                    {formatTime(msg.timestamp)}
                  </Text>
                </View>

                {/* Event blocks if present */}
                {msg.events && msg.events.length > 0 && (
                  <View style={styles.eventBlocksContainer}>
                    {msg.events.map((event, eventIndex) => (
                      <View key={eventIndex}>
                        <EventBlock 
                          event={event}
                          onPress={() => {
                            // Handle event block press - could navigate to event details
                            console.log('Event pressed:', event.name);
                          }}
                        />
                        {/* Content break between events (except after the last one) */}
                        {eventIndex < msg.events.length - 1 && (
                          <View style={styles.eventSeparator}>
                            <View style={styles.separatorContainer}>
                              <LinearGradient
                                colors={[backgroundColor, iconColor + '4D']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.separatorFadeLeft}
                              />
                              <View style={[styles.separatorLine, { backgroundColor: iconColor }]} />
                              <LinearGradient
                                colors={[iconColor + '4D', backgroundColor]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.separatorFadeRight}
                              />
                            </View>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}

                {/* Place blocks if present */}
                {msg.places && msg.places.length > 0 && (
                  <View style={styles.eventBlocksContainer}>
                    {msg.places.map((place, placeIndex) => (
                      <View key={placeIndex}>
                        <PlaceBlock 
                          place={place}
                          onPress={() => {
                            // Handle place block press - could navigate to place details
                            console.log('Place pressed:', place.name);
                          }}
                        />
                        {/* Content break between places (except after the last one) */}
                        {placeIndex < msg.places.length - 1 && (
                          <View style={styles.eventSeparator}>
                            <View style={styles.separatorContainer}>
                              <LinearGradient
                                colors={[backgroundColor, iconColor + '4D']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.separatorFadeLeft}
                              />
                              <View style={[styles.separatorLine, { backgroundColor: iconColor }]} />
                              <LinearGradient
                                colors={[iconColor + '4D', backgroundColor]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.separatorFadeRight}
                              />
                            </View>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
            
            {loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={tintColor} />
                <Text style={[styles.loadingText, { color: textColor }]}>
                  LocalAI is thinking...
                </Text>
              </View>
            )}
          </ScrollView>

          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.inputContainer}
          >
            <View style={[styles.inputRow, { backgroundColor }]}>
              <TextInput
                style={[styles.input, { color: textColor, borderColor: '#666666' }]}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Ask me anything..."
                placeholderTextColor="#999"
                multiline
                maxHeight={100}
                onSubmitEditing={sendMessage}
              />
              <TouchableOpacity 
                style={[
                  styles.sendButton,
                  { backgroundColor: inputText.trim() && !loading ? '#007AFF' : '#666666' }
                ]}
                onPress={sendMessage}
                disabled={!inputText.trim() || loading}
              >
                <Ionicons 
                  name={loading ? "hourglass-outline" : "send"} 
                  size={20} 
                  color="white" 
                />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </>
      )}

      {/* Location Dropdown Modal */}
      <Modal
        visible={showLocationDropdown}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLocationDropdown(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowLocationDropdown(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={[styles.dropdownModal, { backgroundColor }]}>
                <Text style={[styles.dropdownTitle, { color: textColor }]}>
                  Select Location
                </Text>
                {locationOptions.map((option, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.dropdownOption,
                      option === selectedLocationOption && styles.selectedOption
                    ]}
                    onPress={() => handleLocationOptionSelect(option)}
                  >
                    <Ionicons 
                      name={option === 'Use Location' ? 'location' : 'location-outline'} 
                      size={20} 
                      color={option === selectedLocationOption ? tintColor : textColor} 
                    />
                    <Text style={[
                      styles.dropdownOptionText, 
                      { color: option === selectedLocationOption ? tintColor : textColor }
                    ]}>
                      {option}
                    </Text>
                    {option === selectedLocationOption && (
                      <Ionicons name="checkmark" size={20} color={tintColor} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#666666',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  locationDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  locationDropdownText: {
    fontSize: 14,
    fontWeight: '500',
  },
  clearButton: {
    padding: 4,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500',
  },
  messageBubble: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 18,
    marginBottom: 12,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#666666',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
  },
  userMessageText: {
    color: 'white',
    fontWeight: '500',
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
  },
  userTimestamp: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'right',
  },
  assistantTimestamp: {
    color: '#cccccc',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    fontStyle: 'italic',
    fontWeight: '500',
  },
  inputContainer: {
    borderTopWidth: 1,
    borderTopColor: '#666666',
  },
  inputRow: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'flex-end',
    gap: 12,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventBlocksContainer: {
    marginTop: 8,
    marginBottom: 4,
  },
  eventSeparator: {
    marginVertical: 16,
    alignItems: 'center',
  },
  separatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '80%',
  },
  separatorFadeLeft: {
    flex: 1,
    height: 1,
  },
  separatorLine: {
    flex: 2,
    height: 1,
    opacity: 0.4,
  },
  separatorFadeRight: {
    flex: 1,
    height: 1,
  },
  // Centered layout styles (when no messages)
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  centeredInputContainer: {
    alignItems: 'center',
    width: '100%',
  },
  centeredInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    width: '100%',
    maxWidth: 400, // Max width for larger screens
    marginTop: 40, // Space between title and input
  },
  centeredInputField: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#3a3a3a',
    paddingHorizontal: 20, // Increased from 16
    paddingVertical: 16, // Increased from 12
    minHeight: 56, // Minimum touch target height
  },
  centeredInput: {
    fontSize: 16,
    color: '#ffffff',
    textAlignVertical: 'center', // Center text vertically in larger container
  },
  centeredSendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centeredContent: {
    alignItems: 'center',
  },
  centeredTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  centeredSubtitle: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
    marginBottom: 8, // Small space below subtitle
  },
  // Modal and dropdown styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownModal: {
    minWidth: 200,
    maxWidth: 300,
    borderRadius: 12,
    padding: 16,
    margin: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  dropdownTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
    gap: 12,
  },
  selectedOption: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  dropdownOptionText: {
    fontSize: 16,
    flex: 1,
  },
});