import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Share,
  TextInput,
  Image,
  Switch,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useGroups, Event } from '../../contexts/GroupsContext';
import { ApiService } from '../../services/api';

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

const parseEventDate = (date: string): Date | null => {
  if (!date) return null;
  const datePart = date.split(' to ')[0];
  const d = new Date(datePart + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
};

const EventCard = ({ event, onPress, onUnsave, onShare }: {
  event: Event;
  onPress: () => void;
  onUnsave: () => void;
  onShare: () => void;
}) => {
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
          <TouchableOpacity onPress={onUnsave} hitSlop={{ top: 16, bottom: 16 }} style={styles.eventSaveButton}>
            <Text style={styles.eventSaveButtonText}>Saved</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onShare} hitSlop={{ top: 16, bottom: 16 }} style={styles.eventShareButton}>
            <Ionicons name="share-outline" size={16} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default function SavedTab() {
  const insets = useSafeAreaInsets();
  const { savedEvents, setSavedEvents } = useGroups();
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [showPastEvents, setShowPastEvents] = useState(false);

  useEffect(() => {
    ApiService.trackEvent('page_view', 'page', 'saved');
  }, []);

  // Filter and sort events
  useEffect(() => {
    let filtered = savedEvents || [];

    // Filter by date unless showing past events
    if (!showPastEvents) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      filtered = filtered.filter(event => {
        const eventDate = parseEventDate(event.date);
        if (!eventDate) return true;
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

    // Sort by date ascending (soonest first)
    filtered.sort((a, b) => {
      const dateA = parseEventDate(a.date);
      const dateB = parseEventDate(b.date);
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return dateA.getTime() - dateB.getTime();
    });

    setFilteredEvents(filtered);
  }, [savedEvents, searchQuery, showPastEvents]);

  const handleEventPress = (event: Event) => {
    router.push({
      pathname: '/event-detail',
      params: { event: JSON.stringify(event), source: 'saved' }
    });
  };

  const handleUnsaveEvent = (eventId: number) => {
    setSavedEvents(prev => prev.filter(event => event.id !== eventId));
  };

  const handleShareEvent = async (event: Event) => {
    try {
      const shareContent = {
        message: `Check out this event: ${event.name}\n\nDate: ${event.date}\nTime: ${event.time}\nPrice: ${event.price || 'Free'}\n\n${event.description}`,
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
      <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>Saved Events</Text>
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
            <Text style={styles.headerSubtitle}>
              {searchQuery ? `${filteredEvents.length} of ${(savedEvents || []).length}` : `${(savedEvents || []).length}`} event{(savedEvents || []).length === 1 ? '' : 's'} {searchQuery ? 'found' : 'saved'}
            </Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color="#6b7280" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search saved events..."
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

      {/* Content */}
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {(savedEvents || []).length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="heart-outline" size={64} color="#4b5563" />
            </View>
            <Text style={styles.emptyTitle}>No Saved Events</Text>
            <Text style={styles.emptySubtitle}>
              Events you save will appear here.{'\n'}
              Tap Save on any event to keep it!
            </Text>
          </View>
        ) : (
          <View style={styles.eventsGrid}>
            {filteredEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onPress={() => handleEventPress(event)}
                onUnsave={() => handleUnsaveEvent(event.id)}
                onShare={() => handleShareEvent(event)}
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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
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
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 22,
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
});
