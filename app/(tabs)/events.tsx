import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Share,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useGroups, Event, Group } from '../../contexts/GroupsContext';
import { ApiService } from '../../services/api';
import GroupSelectionModal from '../../components/GroupSelectionModal';

const { width } = Dimensions.get('window');

// Compact Event Card for horizontal scrolling
const CompactEventCard = ({ event, onPress, onAddToGroup, onShare }: { 
  event: Event; 
  onPress: () => void;
  onAddToGroup: (event: Event) => void;
  onShare: (event: Event) => void;
}) => {
  const { toggleSaveEvent, isEventSaved } = useGroups();

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      festival: '#8b5cf6',
      music: '#06b6d4', 
      outdoor: '#10b981',
      food: '#f59e0b',
      sports: '#ef4444',
      arts: '#f97316',
      business: '#0ea5e9',
      community: '#84cc16',
    };
    return colors[type] || '#6b7280';
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      festival: 'musical-notes',
      music: 'musical-note',
      outdoor: 'trail-sign', 
      food: 'restaurant',
      sports: 'fitness',
      arts: 'color-palette',
      business: 'briefcase',
      community: 'people',
    };
    return icons[type] || 'calendar';
  };

  const handleSaveEvent = () => {
    toggleSaveEvent(event);
  };

  const handleAddToGroup = () => {
    onAddToGroup(event);
  };

  const handleShare = () => {
    onShare(event);
  };

  const isSaved = isEventSaved(event.id);

  // Format price to remove decimals and USD
  const formatPrice = (price: string) => {
    if (price.toLowerCase().includes('free')) return 'Free';
    // Remove decimals, USD, and extra text
    const cleanPrice = price.replace(/\$(\d+)\.?\d*.*/, '$$$1');
    return cleanPrice;
  };

  // Format time to just 12 PM/AM
  const formatTime = (time: string) => {
    if (time.toLowerCase().includes('tbd') || time.toLowerCase().includes('fallback')) return 'TBD';
    // Extract time and convert to 12-hour format if needed
    const timeMatch = time.match(/(\d{1,2}):?(\d{2})?\s?(AM|PM|am|pm)?/i);
    if (timeMatch) {
      let hour = parseInt(timeMatch[1]);
      const minute = timeMatch[2] || '00';
      const period = timeMatch[3]?.toUpperCase();
      
      if (!period) {
        // Convert 24-hour to 12-hour
        const ampm = hour >= 12 ? 'PM' : 'AM';
        hour = hour % 12 || 12;
        return `${hour} ${ampm}`;
      } else {
        return `${hour} ${period}`;
      }
    }
    return time;
  };

  // Format distance to just "# miles"
  const formatDistance = (distance: string) => {
    if (distance.toLowerCase().includes('fallback')) return 'TBD';
    const match = distance.match(/(\d+)/);
    if (match) {
      return `${match[1]} miles`;
    }
    return distance;
  };

  return (
    <TouchableOpacity style={styles.compactEventCard} onPress={onPress} activeOpacity={0.8}>
      {/* Event Image */}
      {event.image_url ? (
        <Image source={{ uri: event.image_url }} style={styles.compactEventImage} />
      ) : (
        <View style={styles.compactEventImagePlaceholder}>
          <View style={styles.compactEventImageOverlay}>
            <Ionicons name="image-outline" size={40} color="#6b7280" />
            <Text style={styles.compactEventImageText}>Event Photo</Text>
          </View>
        </View>
      )}
      
      {/* Header at Bottom - Three rows */}
      <View style={styles.compactEventHeader}>
        {/* Top Row: Title */}
        <View style={styles.compactEventTopRow}>
          <View style={styles.compactEventTitleContainer}>
            <Text style={styles.compactEventTitle} numberOfLines={1}>{event.name}</Text>
          </View>
        </View>
        
        {/* Middle Row: Price, Time, Distance */}
        <View style={styles.compactEventMiddleRow}>
          <Text style={styles.compactEventPrice}>{formatPrice(event.price)}</Text>
          <Text style={styles.compactEventTime}>{formatTime(event.time)}</Text>
          <Text style={styles.compactEventDistance}>{formatDistance(event.distance)}</Text>
        </View>

        {/* Bottom Row: Action Buttons */}
        <View style={styles.compactEventBottomRow}>
          <View style={styles.compactActionButtons}>
            <TouchableOpacity style={styles.compactShareButton} onPress={handleShare}>
              <Ionicons name="share-outline" size={18} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.compactAddButton} onPress={handleAddToGroup}>
              <Ionicons name="add" size={18} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.compactSaveButton} onPress={handleSaveEvent}>
              <Ionicons 
                name={isSaved ? "heart" : "heart-outline"} 
                size={20} 
                color={isSaved ? "#ef4444" : "#ffffff"} 
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};


export default function ExploreTab() {
  const insets = useSafeAreaInsets();
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [selectedEventForGroup, setSelectedEventForGroup] = useState<Event | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setIsLoading(true);
      
      const { events: apiEvents } = await ApiService.getAllEvents();
      console.log('API Response:', { apiEvents, length: apiEvents?.length });
      
      if (apiEvents && apiEvents.length > 0) {
        // Convert API events to the format expected by the UI
        const formattedEvents: Event[] = apiEvents.map(apiEvent => ({
          id: parseInt(apiEvent.id.replace('EVT_', '')) || Math.random(), // Convert back to number for compatibility
          name: apiEvent.name,
          date: apiEvent.date || 'TBD',
          description: apiEvent.description || '',
          time: apiEvent.time || 'TBD',
          price: apiEvent.is_free ? 'Free' : `$${apiEvent.price} ${apiEvent.currency}`,
          distance: '5 miles away', // This would come from location calculation
          type: (apiEvent.category as Event['type']) || 'music',
          tags: apiEvent.tags || []
        }));
        
        setEvents(formattedEvents);
      } else {
        // No events in database, use fallback
        setEvents(getFallbackEvents());
      }
    } catch (error) {
      console.log('API not available, using fallback events');
      // Fallback to hardcoded events if API fails
      setEvents(getFallbackEvents());
    } finally {
      setIsLoading(false);
    }
  };


  const getFallbackEvents = (): Event[] => [
    {
      id: 1,
      name: "FALLBACK - Summer Music Festival",
      date: "FALLBACK - Sat, July 19",
      description: "FALLBACK - Live bands, food trucks, and craft beer",
      time: "FALLBACK - 2:00 PM",
      price: "FALLBACK - $15 per person",
      distance: "FALLBACK - 12 miles away",
      type: "festival",
      tags: ["music", "family-friendly", "outdoor"]
    },
    {
      id: 2,
      name: "FALLBACK - Jazz Night at Blue Note",
      date: "FALLBACK - Fri, July 18",
      description: "FALLBACK - Local jazz quartet performing classics",
      time: "FALLBACK - 7:00 PM",
      price: "FALLBACK - $20 cover",
      distance: "FALLBACK - 3 miles away",
      type: "music",
      tags: ["music", "nightlife", "indoor"]
    },
    {
      id: 3,
      name: "FALLBACK - Hiking at Auburn State Park",
      date: "FALLBACK - Sun, July 21",
      description: "FALLBACK - Morning hike with scenic views",
      time: "FALLBACK - 8:00 AM",
      price: "FALLBACK - $5 parking",
      distance: "FALLBACK - 25 miles away",
      type: "outdoor",
      tags: ["outdoor", "exercise", "family-friendly"]
    }
  ];

  const handleEventPress = (event: Event) => {
    router.push({
      pathname: '/event-detail',
      params: { event: JSON.stringify(event) }
    });
  };

  const handleShareEvent = async (event: Event) => {
    try {
      const shareContent = {
        message: `Check out this event: ${event.name}\n\nDate: ${event.date}\nTime: ${event.time}\nLocation: ${event.distance}\nPrice: ${event.price}\n\n${event.description}`,
        title: event.name,
      };
      
      await Share.share(shareContent);
    } catch (error) {
      console.error('Error sharing event:', error);
    }
  };

  const handleAddToGroup = (event: Event) => {
    setSelectedEventForGroup(event);
    setShowGroupModal(true);
  };

  const handleGroupSelected = (group: Group, event: Event) => {
    router.push({
      pathname: '/group/[id]',
      params: { 
        id: group.id,
        pendingEvent: JSON.stringify(event)
      }
    });
  };

  // Get events grouped by categories (tags)
  const getEventCategories = () => {
    const categories: { [key: string]: Event[] } = {};
    
    // Priority categories that should appear first if they have events
    const priorityCategories = ['free', 'popular', 'music', 'family-friendly', 'outdoor', 'food', 'nightlife'];
    
    events.forEach(event => {
      (event.tags || []).forEach(tag => {
        if (!categories[tag]) {
          categories[tag] = [];
        }
        categories[tag].push(event);
      });
    });

    // Sort categories: priority first, then alphabetically
    const sortedCategories = Object.keys(categories).sort((a, b) => {
      const aIndex = priorityCategories.indexOf(a);
      const bIndex = priorityCategories.indexOf(b);
      
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      } else if (aIndex !== -1) {
        return -1;
      } else if (bIndex !== -1) {
        return 1;
      } else {
        return a.localeCompare(b);
      }
    });

    return sortedCategories.map(category => ({
      name: category,
      events: categories[category].slice(0, 10) // Limit to 10 events per category
    }));
  };

  const eventCategories = getEventCategories();

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Explore</Text>
            <Text style={styles.headerSubtitle}>
              Discover events by category
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.searchButton} 
            onPress={() => router.push('/events-search')}
          >
            <Ionicons name="search" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Categories */}
      <ScrollView 
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading events...</Text>
          </View>
        ) : (
          <View style={styles.categoriesContainer}>
            {eventCategories.map((category, index) => (
              <View key={category.name} style={styles.categorySection}>
                <View style={styles.categoryHeader}>
                  <Text style={styles.categoryTitle}>
                    {category.name.charAt(0).toUpperCase() + category.name.slice(1).replace('-', ' ')}
                  </Text>
                  <Text style={styles.categoryCount}>
                    {category.events.length} event{category.events.length === 1 ? '' : 's'}
                  </Text>
                </View>
                
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={styles.categoryScrollView}
                  contentContainerStyle={styles.categoryScrollContent}
                >
                  {category.events.map((event) => (
                    <CompactEventCard
                      key={event.id}
                      event={event}
                      onPress={() => handleEventPress(event)}
                      onAddToGroup={handleAddToGroup}
                      onShare={handleShareEvent}
                    />
                  ))}
                </ScrollView>
              </View>
            ))}
            
            {eventCategories.length === 0 && (
              <View style={styles.noEventsContainer}>
                <Ionicons name="calendar-outline" size={64} color="#4b5563" />
                <Text style={styles.noEventsTitle}>No Events Available</Text>
                <Text style={styles.noEventsSubtitle}>
                  Check back later for new events or use the search to find specific events.
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
      
      <GroupSelectionModal
        visible={showGroupModal}
        onClose={() => setShowGroupModal(false)}
        event={selectedEventForGroup!}
        onGroupSelected={handleGroupSelected}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  headerContainer: {
    backgroundColor: '#1a1a1a',
    elevation: 10,
  },
  header: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#9ca3af',
  },
  searchButton: {
    backgroundColor: '#2563eb',
    padding: 12,
    borderRadius: 8,
  },
  scrollContainer: {
    flex: 1,
  },
  categoriesContainer: {
    paddingVertical: 16,
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  categoryTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
  },
  categoryCount: {
    fontSize: 14,
    color: '#9ca3af',
  },
  categoryScrollView: {
    paddingLeft: 20,
  },
  categoryScrollContent: {
    paddingRight: 20,
    gap: 12,
    alignItems: 'flex-start',
  },
  compactEventCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    width: width * 0.5,
    height: 300,
    overflow: 'hidden',
    position: 'relative',
  },
  compactEventImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#2a2a2a',
  },
  compactEventImagePlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: width * 0.5,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactEventImageOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactEventImageText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
  compactEventHeader: {
    position: 'absolute',
    top: width * 0.5 + 4,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  compactEventTopRow: {
    marginBottom: 20,
  },
  compactEventMiddleRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  compactEventBottomRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  compactEventTitleContainer: {
    flex: 1,
    minHeight: 30,
  },
  compactEventTitle: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
    lineHeight: 18,
    textAlignVertical: 'center',
  },
  compactEventPrice: {
    fontSize: 11,
    color: '#4ade80',
    fontWeight: '600',
    lineHeight: 16,
    textAlignVertical: 'center',
  },
  compactEventTime: {
    fontSize: 11,
    color: '#fb923c',
    fontWeight: '500',
    lineHeight: 16,
    textAlignVertical: 'center',
  },
  compactEventDistance: {
    fontSize: 11,
    color: '#f87171',
    fontWeight: '500',
    lineHeight: 16,
    textAlignVertical: 'center',
  },
  compactActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compactShareButton: {
    padding: 6,
    backgroundColor: 'rgba(55, 65, 81, 0.9)',
    borderRadius: 4,
    minWidth: 28,
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactAddButton: {
    padding: 6,
    backgroundColor: 'rgba(30, 58, 138, 0.9)',
    borderRadius: 4,
    minWidth: 28,
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactSaveButton: {
    padding: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 4,
    minWidth: 28,
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#9ca3af',
  },
  noEventsContainer: {
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  noEventsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  noEventsSubtitle: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 22,
  },
});