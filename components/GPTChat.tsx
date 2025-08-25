import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/useThemeColor';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import EventBlock from './EventBlock';

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

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  events?: EventData[];
}

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
}

// Function to parse events from AI response and clean text
const parseEventsFromResponse = (responseText: string, apiEvents?: any[]): { events: EventData[], cleanedText: string } => {
  const events: EventData[] = [];
  let cleanedText = responseText;
  
  // If the API returned structured events data, use that
  if (apiEvents && Array.isArray(apiEvents)) {
    apiEvents.forEach(event => {
      if (event && typeof event === 'object') {
        events.push({
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
        });
      }
    });
  }
  
  // Parse events from the response text using various patterns
  // Order patterns by specificity - most specific first to avoid conflicts
  const patterns = [
    // Pattern 1: Calendar emoji format - enhanced to capture multiple events separated by double newlines
    /📅\s*([^\n]+)\n\n([\s\S]*?)(?=\n\n📅|\n\n$|$)/gi,
    
    // Pattern 2: "Event: Name\nDate: ...\nTime: ..." format
    /(?:Event|EVENT):\s*([^\n]+)(?:\n.*?(?:Date|DATE):\s*([^\n]+))?(?:\n.*?(?:Time|TIME):\s*([^\n]+))?(?:\n.*?(?:Location|LOCATION):\s*([^\n]+))?(?:\n.*?(?:Price|PRICE):\s*([^\n]+))?/gi,
    
    // Pattern 3: "**Event Name**\n- Date: ...\n- Time: ..." format
    /\*\*([^*\n]+)\*\*\s*(?:\n[-•]\s*(?:Date|When):\s*([^\n]+))?(?:\n[-•]\s*(?:Time):\s*([^\n]+))?(?:\n[-•]\s*(?:Location|Where):\s*([^\n]+))?(?:\n[-•]\s*(?:Price|Cost):\s*([^\n]+))?/gi,
    
    // Pattern 4: "1. Event Name - Date, Time, Location" format
    /\d+\.\s*([^-\n]+)\s*-\s*([^,\n]+)(?:,\s*([^,\n]+))?(?:,\s*([^,\n]+))?(?:,\s*([^\n]+))?/gi,
  ];
  
  // Keep track of processed text regions to avoid duplicates
  const processedRegions: string[] = [];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(responseText)) !== null) {
      const fullMatch = match[0];
      let name, date, time, location, price, description = '';
      
      // Skip if we've already processed this text region
      if (processedRegions.some(region => fullMatch.includes(region) || region.includes(fullMatch))) {
        continue;
      }
      
      if (pattern === patterns[0]) { // Calendar emoji format: 📅 Date\n\nContent
        const [, eventDate, content] = match;
        const lines = content.split('\n').map(line => line.trim()).filter(line => line);
        
        date = eventDate?.trim();
        name = lines[0] || ''; // First line is event name
        description = lines[1] || ''; // Second line is description
        
        // Look for time and location in format "12:00 PM @ Venue (Location)"
        const timeLocationLine = lines.find(line => line.includes('@') && (line.includes('PM') || line.includes('AM')));
        if (timeLocationLine) {
          const timeMatch = timeLocationLine.match(/^([^@]+)/);
          time = timeMatch ? timeMatch[1].trim() : '';
          
          const venueMatch = timeLocationLine.match(/@\s*([^(]+)(\([^)]+\))?/);
          if (venueMatch) {
            const venue = venueMatch[1].trim();
            const locationInParens = venueMatch[2] ? venueMatch[2].replace(/[()]/g, '').trim() : '';
            location = venue && locationInParens ? `${venue}, ${locationInParens}` : venue || locationInParens;
          }
        }
        
        // Look for price line
        const priceLine = lines.find(line => line.toLowerCase().includes('price:'));
        if (priceLine) {
          price = priceLine.replace(/price:\s*/i, '').trim();
        }
      } else if (pattern === patterns[1]) { // Event: format
        [, name, date, time, location, price] = match;
      } else if (pattern === patterns[2]) { // **Event** format
        [, name, date, time, location, price] = match;
      } else if (pattern === patterns[3]) { // numbered list format
        [, name, date, time, location, price] = match;
      }
      
      if (name && name.trim()) {
        const eventData = {
          id: Math.random().toString(),
          name: name.trim(),
          description: description || '',
          date: date?.trim() || '',
          time: time?.trim() || '',
          price: price?.trim() || '',
          is_free: price?.toLowerCase().includes('free') || price?.toLowerCase().includes('$0') || false,
          location: location?.trim() || '',
          venue_name: '',
          image_url: '',
        };
        
        // Only add events that have meaningful data (not just a date as name)
        const hasValidData = eventData.name && (
          eventData.description || 
          eventData.time || 
          eventData.location || 
          eventData.price ||
          !eventData.name.match(/^\w+,?\s+\w+\s+\d+$/) // Don't treat "Saturday, Jul 25" as an event name
        );
        
        if (hasValidData) {
          // Debug log to see what data we're extracting
          console.log('Extracted valid event data:', eventData);
          events.push(eventData);
          
          // Mark this region as processed
          processedRegions.push(fullMatch);
        } else {
          console.log('Skipping invalid event data:', eventData);
        }
        
        // Remove the event information from the text
        cleanedText = cleanedText.replace(fullMatch, '').trim();
      }
    }
  });
  
  // Clean up the text - remove extra whitespace and empty lines
  cleanedText = cleanedText
    .replace(/\n\n\n+/g, '\n\n') // Replace multiple empty lines with double newline
    .replace(/^\s+|\s+$/g, '') // Trim whitespace
    .replace(/^[-•]\s*$/gm, '') // Remove empty bullet points
    .replace(/\n\n+/g, '\n\n'); // Clean up spacing
  
  // If we found events, replace the cleaned text with a simple message
  if (events.length > 0) {
    if (events.length === 1) {
      cleanedText = `I found 1 event for you:`;
    } else {
      cleanedText = `I found ${events.length} events for you:`;
    }
  }
  
  return { events, cleanedText };
};

export default function GPTChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<LocationData | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [isWatchingLocation, setIsWatchingLocation] = useState<boolean>(false);

  const backgroundColor = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');
  const iconColor = useThemeColor({}, 'icon');

  // Get user location on component mount
  useEffect(() => {
    (async () => {
      try {
        // Request location permissions
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.log('Permission to access location was denied');
          setLocationPermission(false);
          return;
        }

        setLocationPermission(true);

        // Try multiple approaches for best accuracy
        let location;
        
        try {
          // First try: Most aggressive GPS settings
          console.log('Attempting high-precision GPS location...');
          location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.BestForNavigation, // Most accurate available
            maximumAge: 5000, // Accept location up to 5 seconds old
            timeout: 25000, // Wait up to 25 seconds for GPS lock
          });
        } catch (error) {
          console.log('High precision failed, trying high accuracy:', error);
          // Fallback: High accuracy
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

        console.log('Location obtained:');
        console.log('- Latitude:', location.coords.latitude);
        console.log('- Longitude:', location.coords.longitude);
        console.log('- Accuracy:', location.coords.accuracy, 'meters');
        console.log('- Altitude:', location.coords.altitude);
        console.log('- Speed:', location.coords.speed);
        console.log('- Timestamp:', new Date(location.timestamp));
        
        // Start watching location for continuous updates if accuracy is poor
        if (location.coords.accuracy > 500) { // If accuracy worse than 500m
          console.log('Starting location watch for better accuracy...');
          startLocationWatch();
        }
      } catch (error) {
        console.error('Error getting location:', error);
        setLocationPermission(false);
      }
    })();
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
    
    console.log('Sending message with location:', userLocation);
    
    // Add user message immediately
    const newUserMessage: Message = {
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newUserMessage]);
    setLoading(true);

    try {
      console.log('Sending request with data:', {
        message: userMessage,
        includeEvents: true,
        location: userLocation,
        enablePlaces: true,
      });

      const response = await fetch('https://group-event.vercel.app/api/gpt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          includeEvents: true,
          location: userLocation,
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
        // Parse events from the response and get cleaned text
        const { events, cleanedText } = parseEventsFromResponse(data.response, data.events);
        
        const assistantMessage: Message = {
          role: 'assistant',
          content: cleanedText,
          timestamp: new Date(),
          events: events.length > 0 ? events : undefined,
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
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Ionicons name="sparkles" size={24} color={tintColor} />
          <Text style={[styles.title, { color: textColor }]}>LocalAI</Text>
        </View>
        
        <View style={styles.headerControls}>
          <View style={styles.locationStatus}>
            <Ionicons 
              name={userLocation ? "location" : "location-outline"} 
              size={16} 
              color={userLocation ? "#10b981" : "#6b7280"} 
            />
            <Text style={[
              styles.locationText,
              { color: userLocation ? "#10b981" : "#6b7280" }
            ]}>
              {userLocation ? 
                `Location ON (±${Math.round(userLocation.accuracy || 0)}m)${isWatchingLocation ? ' 🔄' : ''}` : 
                "Location OFF"
              }
            </Text>
            {userLocation && userLocation.accuracy && userLocation.accuracy > 1000 && (
              <TouchableOpacity onPress={refreshLocation} style={styles.refreshLocationButton}>
                <Ionicons name="refresh" size={14} color="#f59e0b" />
              </TouchableOpacity>
            )}
            {userLocation && userLocation.accuracy && userLocation.accuracy > 200 && !isWatchingLocation && (
              <TouchableOpacity onPress={startLocationWatch} style={styles.watchLocationButton}>
                <Ionicons name="eye" size={14} color="#3b82f6" />
              </TouchableOpacity>
            )}
          </View>
          {messages.length > 0 && (
            <TouchableOpacity onPress={clearChat} style={styles.clearButton}>
              <Ionicons name="trash-outline" size={20} color={tintColor} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView 
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
      >
        {messages.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubble-outline" size={64} color="#ccc" />
            <Text style={styles.emptyStateText}>
              Ask LocalAI about events, restaurants, or group planning!
            </Text>
            <Text style={styles.emptyStateSubtext}>
              I have access to local events and nearby places via Google Places
            </Text>
          </View>
        )}
        
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
            style={[styles.input, { color: textColor, borderColor: '#e0e0e0' }]}
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
              { backgroundColor: tintColor },
              (!inputText.trim() || loading) && styles.sendButtonDisabled
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
    borderBottomColor: '#e0e0e0',
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
  locationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  locationText: {
    fontSize: 12,
    fontWeight: '500',
  },
  refreshLocationButton: {
    marginLeft: 4,
    padding: 2,
  },
  watchLocationButton: {
    marginLeft: 4,
    padding: 2,
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
    borderColor: '#e0e0e0',
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
    borderTopColor: '#e0e0e0',
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
  sendButtonDisabled: {
    opacity: 0.5,
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
});