import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useGroups, Event, Group } from '../../contexts/GroupsContext';
import { ApiService, Event as ApiEvent } from '../../services/api';
import GroupSelectionModal from '../../components/GroupSelectionModal';

const { width, height } = Dimensions.get('window');

const EventIcon = ({ type }: { type: Event['type'] }) => {
  const iconMap = {
    festival: 'musical-notes',
    music: 'musical-note',
    outdoor: 'trail-sign',
    food: 'restaurant',
  } as const;
  
  return (
    <Ionicons 
      name={iconMap[type] || 'calendar'} 
      size={24} 
      color="#ffffff" 
    />
  );
};

const EventCard = ({ event, onPress, onAddToGroup, onShare }: { 
  event: Event; 
  onPress: () => void;
  onAddToGroup: (event: Event) => void;
  onShare: (event: Event) => void;
}) => {
  const { toggleSaveEvent, isEventSaved } = useGroups();

  const getTypeColor = (type: Event['type']) => {
    const colors = {
      festival: '#8b5cf6',
      music: '#06b6d4', 
      outdoor: '#10b981',
      food: '#f59e0b',
    };
    return colors[type] || '#6b7280';
  };

  const getTypeIcon = (type: Event['type']) => {
    const icons = {
      festival: 'musical-notes',
      music: 'musical-note',
      outdoor: 'trail-sign', 
      food: 'restaurant',
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

  return (
    <TouchableOpacity style={styles.eventCard} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.eventHeader}>
        <View style={[styles.eventTypeIcon, { backgroundColor: getTypeColor(event.type) }]}>
          <Ionicons name={getTypeIcon(event.type)} size={16} color="#ffffff" />
        </View>
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
            <Ionicons name="share-outline" size={18} color="#9ca3af" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton} onPress={handleAddToGroup}>
            <Ionicons name="add" size={18} color="#60a5fa" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveButton} onPress={handleSaveEvent}>
            <Ionicons 
              name={isSaved ? "heart" : "heart-outline"} 
              size={20} 
              color={isSaved ? "#ef4444" : "#9ca3af"} 
            />
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.eventContent}>
        <Text style={styles.eventName}>{event.name}</Text>
        <Text style={styles.eventDate}>{event.date}</Text>
        <Text style={styles.eventDescription} numberOfLines={2}>
          {event.description}
        </Text>
        <View style={styles.eventDetailsRow}>
          <Text style={styles.eventTime}>{event.time}</Text>
          <Text style={styles.eventDistance}>{event.distance}</Text>
          <Text style={styles.eventPrice}>{event.price}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};


export default function EventsTab() {
  const { setSelectedEvent, setSourceLayout } = useGroups();
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
          type: (apiEvent.category as Event['type']) || 'music'
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
      type: "festival"
    },
    {
      id: 2,
      name: "FALLBACK - Jazz Night at Blue Note",
      date: "FALLBACK - Fri, July 18",
      description: "FALLBACK - Local jazz quartet performing classics",
      time: "FALLBACK - 7:00 PM",
      price: "FALLBACK - $20 cover",
      distance: "FALLBACK - 3 miles away",
      type: "music"
    },
    {
      id: 3,
      name: "FALLBACK - Hiking at Auburn State Park",
      date: "FALLBACK - Sun, July 21",
      description: "FALLBACK - Morning hike with scenic views",
      time: "FALLBACK - 8:00 AM",
      price: "FALLBACK - $5 parking",
      distance: "FALLBACK - 25 miles away",
      type: "outdoor"
    }
  ];

  const handleEventPress = (event: Event) => {
    setSelectedEvent(event);
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
    // Navigate to group page with event data
    router.push({
      pathname: '/group/[id]',
      params: { 
        id: group.id,
        pendingEvent: JSON.stringify(event)
      }
    });
  };


  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Events</Text>
            <Text style={styles.headerSubtitle}>
              {events.length} event{events.length === 1 ? '' : 's'} available
            </Text>
          </View>
          <TouchableOpacity style={styles.refreshButton} onPress={loadEvents}>
            <Ionicons name="refresh" size={20} color="#60a5fa" />
          </TouchableOpacity>
        </View>
      </View>
      
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.eventsGrid}>
          {events.map(event => (
            <EventCard 
              key={event.id} 
              event={event} 
              onPress={() => handleEventPress(event)}
              onAddToGroup={handleAddToGroup}
              onShare={handleShareEvent}
            />
          ))}
        </View>
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
  },
  header: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 20,
    paddingVertical: 20,
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
  scrollContainer: {
    flex: 1,
    padding: 16,
  },
  eventsGrid: {
    gap: 16,
  },
  eventCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    overflow: 'hidden',
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  eventTypeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shareButton: {
    padding: 6,
    backgroundColor: '#374151',
    borderRadius: 6,
  },
  addButton: {
    padding: 6,
    backgroundColor: '#1e3a8a',
    borderRadius: 6,
  },
  saveButton: {
    padding: 4,
  },
  eventContent: {
    padding: 12,
  },
  eventName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 6,
  },
  eventDate: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 2,
  },
  eventTime: {
    fontSize: 14,
    color: '#fb923c',
    fontWeight: '500',
  },
  eventDistance: {
    fontSize: 14,
    color: '#f87171',
    fontWeight: '500',
  },
  eventPrice: {
    fontSize: 14,
    color: '#4ade80',
    fontWeight: '500',
  },
  eventDescription: {
    fontSize: 14,
    color: '#e5e7eb',
    lineHeight: 18,
    marginBottom: 6,
  },
  eventDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    gap: 16,
  },
  refreshButton: {
    padding: 6,
  },
});