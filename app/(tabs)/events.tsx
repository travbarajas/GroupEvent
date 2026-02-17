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
const CompactEventCard = ({ event, onPress, onShare }: { 
  event: Event; 
  onPress: () => void;
  /* onAddToGroup: (event: Event) => void; // Hidden - preserving for future use */
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

  // Format price - show "Free" for free/$0 events, otherwise price
  const formatPrice = (price: string) => {
    if (price.toLowerCase().includes('free')) return 'Free';
    const match = price.match(/\$(\d+)/);
    if (match && parseInt(match[1]) === 0) return 'Free';
    const cleanPrice = price.replace(/\$(\d+)\.?\d*.*/, '$$$1');
    return cleanPrice;
  };

  // Format date + time into "This Monday at 8 PM" or "3/7 at 4 AM"
  const formatDateTime = (date: string, time: string) => {
    const timePart = (() => {
      if (!time || time.toLowerCase().includes('tbd') || time.toLowerCase().includes('fallback')) return null;
      // Only grab the first/start time from ranges like "8:00 PM - 10:00 PM"
      const timeMatch = time.match(/(\d{1,2}):(\d{2})\s?(AM|PM|am|pm)/i);
      if (timeMatch) {
        let hour = parseInt(timeMatch[1]);
        const minute = timeMatch[2];
        const period = timeMatch[3].toUpperCase();
        return minute === '00' ? `${hour} ${period}` : `${hour}:${minute} ${period}`;
      }
      // Fallback for times without minutes like "8 PM"
      const simpleMatch = time.match(/(\d{1,2})\s?(AM|PM|am|pm)/i);
      if (simpleMatch) {
        return `${parseInt(simpleMatch[1])} ${simpleMatch[2].toUpperCase()}`;
      }
      return null;
    })();

    if (!date) return timePart || 'TBD';

    const datePart = date.split(' to ')[0];
    const eventDate = new Date(datePart + 'T00:00:00');
    if (isNaN(eventDate.getTime())) return timePart || 'TBD';

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    let dateStr: string;
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    if (diffDays === 0) {
      dateStr = 'Today';
    } else if (diffDays === 1) {
      dateStr = 'Tomorrow';
    } else if (diffDays > 1 && diffDays <= 7) {
      dateStr = 'This ' + dayNames[eventDate.getDay()];
    } else {
      dateStr = `${eventDate.getMonth() + 1}/${eventDate.getDate()}`;
    }

    return timePart ? `${dateStr} - ${timePart}` : dateStr;
  };

  return (
    <TouchableOpacity style={styles.compactEventCard} onPress={onPress} activeOpacity={0.8}>
      {/* Event Image */}
      {event.image_url ? (
        <Image source={{ uri: event.image_url }} style={styles.compactEventImage} resizeMode="cover" />
      ) : (
        <View style={styles.compactEventImagePlaceholder}>
          <View style={styles.compactEventImageOverlay}>
            <Ionicons name="image-outline" size={40} color="#6b7280" />
            <Text style={styles.compactEventImageText}>Event Photo</Text>
          </View>
        </View>
      )}
      
      {/* Caption */}
      <View style={styles.compactEventHeader}>
        <View style={styles.compactEventTopRow}>
          <Text style={styles.compactEventTime}>{formatDateTime(event.date, event.time)}</Text>
          <Text style={styles.compactEventPrice}>{formatPrice(event.price)}</Text>
        </View>
        <Text style={styles.compactEventTitle} numberOfLines={1}>{event.name}</Text>
        <Text style={styles.compactEventLocation} numberOfLines={1}>
          {event.venue_name ? `${event.venue_name} - ${event.location || ''}` : event.location || ''}
        </Text>
        <View style={styles.compactEventBottomRow}>
          <TouchableOpacity onPress={handleSaveEvent} hitSlop={{ top: 16, bottom: 16 }} style={styles.compactSaveButton}>
            <Text style={styles.compactSaveButtonText}>{isSaved ? 'Saved' : 'Save'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShare} hitSlop={{ top: 16, bottom: 16 }} style={styles.compactShareButton}>
            <Ionicons name="share-outline" size={16} color="#ffffff" />
          </TouchableOpacity>
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
  const [tagOrder, setTagOrder] = useState<string[]>([]);

  useEffect(() => {
    loadEvents();
    loadTagOrder();
    ApiService.trackEvent('page_view', 'page', 'explore');
  }, []);

  const loadTagOrder = async () => {
    try {
      const { tags } = await ApiService.getTagOrder();
      setTagOrder(tags.map(t => t.tag_name));
    } catch (error) {
      console.log('Failed to load tag order, using defaults');
    }
  };


  const loadEvents = async () => {
    try {
      setIsLoading(true);
      
      const { events: apiEvents } = await ApiService.getAllEvents();

      // Debug: log raw API response to see if image_url is present
      console.log('=== DEBUG IMAGE URL ===');
      console.log('API returned events count:', apiEvents?.length);
      if (apiEvents?.[0]) {
        console.log('First event ALL KEYS:', Object.keys(apiEvents[0]));
        console.log('First event has image_url?:', 'image_url' in apiEvents[0]);
        console.log('First event image_url value:', apiEvents[0].image_url ? `YES - ${apiEvents[0].image_url.substring(0, 50)}...` : 'NO/NULL/UNDEFINED');
      }
      console.log('=== END DEBUG ===')

      if (apiEvents && apiEvents.length > 0) {
        // Convert API events to the format expected by the UI
        const formattedEvents: Event[] = apiEvents.map(apiEvent => ({
          id: parseInt(apiEvent.id.replace('EVT_', '')) || Math.random(), // Convert back to number for compatibility
          name: apiEvent.name,
          date: apiEvent.date || 'TBD',
          description: apiEvent.description || '',
          short_description: apiEvent.short_description || '',
          time: apiEvent.time || 'TBD',
          price: apiEvent.is_free ? 'Free' : `$${apiEvent.price} ${apiEvent.currency}`,
          distance: '5 miles away', // This would come from location calculation
          type: (apiEvent.category as Event['type']) || 'music',
          tags: apiEvent.tags || [],
          image_url: apiEvent.image_url || undefined,
          location: apiEvent.location || undefined,
          venue_name: apiEvent.venue_name || undefined,
        }));
        
        // Filter to events within the next 14 days
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const cutoff = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);

        const filteredEvents = formattedEvents.filter(event => {
          if (!event.date || event.date === 'TBD') return true;
          const datePart = event.date.split(' to ')[0];
          const eventDate = new Date(datePart + 'T00:00:00');
          if (isNaN(eventDate.getTime())) return true;
          return eventDate >= today && eventDate <= cutoff;
        });

        setEvents(filteredEvents);
      } else {
        // No events in database, use fallback
        setEvents(getFallbackEvents());
      }
    } catch (error) {
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
    const priorityCategories = tagOrder.length > 0
      ? tagOrder
      : ['free', 'popular', 'music', 'family-friendly', 'outdoor', 'food', 'nightlife'];
    
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
      <View style={[
        styles.headerContainer, 
        { paddingTop: insets.top }
      ]}>
        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Explore</Text>
            <Text style={styles.headerSubtitle}>
              Discover local events
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
                      /* onAddToGroup={handleAddToGroup} // Hidden - preserving for future use */
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
      
      {/* Group Selection Modal hidden - preserving functionality for future use
      <GroupSelectionModal
        visible={showGroupModal}
        onClose={() => setShowGroupModal(false)}
        event={selectedEventForGroup!}
        onGroupSelected={handleGroupSelected}
      />
      */}
      
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
    zIndex: 1000,
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
    overflow: 'hidden',
  },
  compactEventImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#2a2a2a',
  },
  compactEventImagePlaceholder: {
    width: '100%',
    aspectRatio: 1,
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
    padding: 12,
    backgroundColor: '#1a1a1a',
  },
  compactEventTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  compactEventTime: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  compactEventPrice: {
    fontSize: 12,
    color: '#4ade80',
    fontWeight: '600',
  },
  compactEventTitle: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '700',
    marginBottom: 2,
  },
  compactEventLocation: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '400',
    marginBottom: 6,
  },
  compactEventBottomRow: {
    flexDirection: 'row',
    gap: 8,
  },
  compactShareButton: {
    flex: 1,
    paddingVertical: 6,
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2a2a2a',
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
    flex: 1,
    paddingVertical: 6,
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactSaveButtonText: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '500',
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