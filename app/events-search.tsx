import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Share,
  TextInput,
  Image,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useGroups, Event } from '../contexts/GroupsContext';
import { ApiService } from '../services/api';
import AdminEventModal from '../components/AdminEventModal';
import { useIsAdmin } from '@/hooks/useIsAdmin';

const { width } = Dimensions.get('window');

// Format date + time like explore page
const formatDateTime = (date: string, time: string) => {
  const timePart = (() => {
    if (!time || time.toLowerCase().includes('tbd') || time.toLowerCase().includes('fallback')) return null;
    const timeMatch = time.match(/(\d{1,2}):(\d{2})\s?(AM|PM|am|pm)/i);
    if (timeMatch) {
      let hour = parseInt(timeMatch[1]);
      const minute = timeMatch[2];
      const period = timeMatch[3].toUpperCase();
      return minute === '00' ? `${hour} ${period}` : `${hour}:${minute} ${period}`;
    }
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

const formatPrice = (price: string) => {
  if (price.toLowerCase().includes('free')) return 'Free';
  const match = price.match(/\$(\d+)/);
  if (match && parseInt(match[1]) === 0) return 'Free';
  const cleanPrice = price.replace(/\$(\d+)\.?\d*.*/, '$$$1');
  return cleanPrice;
};

const EventCard = ({ event, onPress, onShare }: {
  event: Event;
  onPress: () => void;
  onShare: (event: Event) => void;
}) => {
  const { toggleSaveEvent, isEventSaved } = useGroups();
  const isSaved = isEventSaved(event.id);

  const handleSaveEvent = () => {
    toggleSaveEvent(event);
  };

  const handleShare = () => {
    onShare(event);
  };

  return (
    <TouchableOpacity style={styles.eventCard} onPress={onPress} activeOpacity={0.8}>
      {event.image_url ? (
        <Image source={{ uri: event.image_url }} style={styles.eventImage} resizeMode="cover" />
      ) : (
        <View style={styles.eventImagePlaceholder}>
          <Ionicons name="image-outline" size={28} color="#6b7280" />
        </View>
      )}
      <View style={styles.eventCaption}>
        <View style={styles.eventTopRow}>
          <Text style={styles.eventTime}>{formatDateTime(event.date, event.time)}</Text>
          <Text style={styles.eventPrice}>{formatPrice(event.price)}</Text>
        </View>
        <Text style={styles.eventTitle} numberOfLines={1}>{event.name}</Text>
        <Text style={styles.eventLocation} numberOfLines={1}>
          {event.venue_name ? `${event.venue_name} - ${event.location || ''}` : event.location || ''}
        </Text>
        <View style={styles.eventBottomRow}>
          <TouchableOpacity onPress={handleSaveEvent} hitSlop={{ top: 16, bottom: 16 }} style={styles.eventSaveButton}>
            <Text style={styles.eventSaveButtonText}>{isSaved ? 'Saved' : 'Save'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShare} hitSlop={{ top: 16, bottom: 16 }} style={styles.eventShareButton}>
            <Ionicons name="share-outline" size={16} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default function EventsSearchScreen() {
  const { isLoaded } = useGroups();
  const isAdmin = useIsAdmin();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showPastEvents, setShowPastEvents] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

  // Filter events when search query or events change
  useEffect(() => {
    let filtered = events;

    // Filter by date unless showing past events
    if (!showPastEvents) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      filtered = filtered.filter(event => {
        const datePart = event.date?.split(' to ')[0];
        if (!datePart) return true;
        const eventDate = new Date(datePart + 'T00:00:00');
        if (isNaN(eventDate.getTime())) return true;
        return eventDate >= today;
      });
    }

    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(event =>
        event.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.date.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredEvents(filtered);
  }, [events, searchQuery, showPastEvents]);

  const loadEvents = async () => {
    try {
      setIsLoading(true);

      const { events: apiEvents } = await ApiService.getAllEvents();

      if (apiEvents && apiEvents.length > 0) {
        const formattedEvents: Event[] = apiEvents.map(apiEvent => ({
          id: parseInt(apiEvent.id.replace('EVT_', '')) || Math.random(),
          name: apiEvent.name,
          date: apiEvent.date || 'TBD',
          description: apiEvent.description || '',
          short_description: apiEvent.short_description || '',
          time: apiEvent.time || 'TBD',
          price: apiEvent.is_free ? 'Free' : `$${apiEvent.price} ${apiEvent.currency}`,
          distance: '5 miles away',
          type: (apiEvent.category as Event['type']) || 'music',
          tags: apiEvent.tags || [],
          image_url: apiEvent.image_url || undefined,
          location: apiEvent.location || undefined,
          venue_name: apiEvent.venue_name || undefined,
        }));

        setEvents(formattedEvents);
      } else {
        setEvents([]);
      }
    } catch (error) {
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEventPress = (event: Event) => {
    router.push({
      pathname: '/event-detail',
      params: { event: JSON.stringify(event) }
    });
  };

  const handleShareEvent = async (event: Event) => {
    try {
      const shareContent = {
        message: `Check out this event: ${event.name}\n\nDate: ${event.date}\nTime: ${event.time}\nPrice: ${event.price}\n\n${event.description}`,
        title: event.name,
      };
      await Share.share(shareContent);
    } catch (error) {
      console.error('Error sharing event:', error);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={[styles.searchTagsContainer, { paddingTop: insets.top + 10 }]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <View style={styles.topBarCenter}>
            <View style={styles.topBarTitleRow}>
              <Text style={styles.topBarTitle}>Search Events</Text>
              <View style={styles.pastEventsToggle}>
                <Text style={styles.pastEventsToggleText}>Past events</Text>
                <Switch
                  value={showPastEvents}
                  onValueChange={setShowPastEvents}
                  trackColor={{ false: '#374151', true: '#93c5fd' }}
                  thumbColor={showPastEvents ? '#60a5fa' : '#9ca3af'}
                />
              </View>
            </View>
            <Text style={styles.topBarSubtitle}>
              {searchQuery ? `${filteredEvents.length} of ${events.length}` : `${events.length}`} event{events.length === 1 ? '' : 's'} {searchQuery ? 'found' : 'available'}
            </Text>
          </View>
          <View style={styles.topBarActions}>
            {isAdmin && (
              <TouchableOpacity style={styles.adminButton} onPress={() => setShowAdminModal(true)}>
                <Ionicons name="add" size={18} color="#ffffff" />
                <Text style={styles.adminButtonText}>Admin</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.refreshButton} onPress={loadEvents}>
              <Ionicons name="refresh" size={20} color="#60a5fa" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color="#6b7280" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search events..."
              placeholderTextColor="#6b7280"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.trim() !== '' && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                <Ionicons name="close" size={18} color="#ffffff" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!isLoaded ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading events...</Text>
          </View>
        ) : (
          <View style={styles.eventsGrid}>
            {filteredEvents.map(event => (
              <EventCard
                key={event.id}
                event={event}
                onPress={() => handleEventPress(event)}
                onShare={handleShareEvent}
              />
            ))}
            {filteredEvents.length === 0 && searchQuery && (
              <View style={styles.noResultsContainer}>
                <Ionicons name="search" size={48} color="#6b7280" />
                <Text style={styles.noResultsText}>No events found</Text>
                <Text style={styles.noResultsSubtext}>Try a different search term</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <AdminEventModal
        visible={showAdminModal}
        onClose={() => setShowAdminModal(false)}
        onEventCreated={() => {
          loadEvents();
          setShowAdminModal(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  searchTagsContainer: {
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  topBarCenter: {
    flex: 1,
  },
  topBarTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBarTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 2,
  },
  topBarSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adminButton: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  adminButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#ffffff',
  },
  clearButton: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 16,
  },
  pastEventsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pastEventsToggleText: {
    fontSize: 13,
    color: '#9ca3af',
    fontWeight: '500',
  },
  eventsGrid: {
    gap: 12,
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
  noResultsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noResultsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#9ca3af',
    marginTop: 16,
    marginBottom: 4,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: '#6b7280',
  },
  eventCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    overflow: 'hidden',
    flexDirection: 'row',
  },
  eventImage: {
    width: 120,
    aspectRatio: 1,
    backgroundColor: '#2a2a2a',
  },
  eventImagePlaceholder: {
    width: 120,
    aspectRatio: 1,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventCaption: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  eventTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  eventTime: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  eventPrice: {
    fontSize: 12,
    color: '#4ade80',
    fontWeight: '600',
  },
  eventTitle: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '700',
    marginBottom: 4,
  },
  eventLocation: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '400',
    marginBottom: 8,
  },
  eventBottomRow: {
    flexDirection: 'row',
    gap: 8,
  },
  eventSaveButton: {
    flex: 1,
    paddingVertical: 6,
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventSaveButtonText: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '500',
  },
  eventShareButton: {
    flex: 1,
    paddingVertical: 6,
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButton: {
    padding: 6,
  },
});
