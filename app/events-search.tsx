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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useGroups, Event } from '../contexts/GroupsContext';
import { ApiService } from '../services/api';
import AdminEventModal from '../components/AdminEventModal';

const { width } = Dimensions.get('window');

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
        <View style={styles.eventTagsContainer}>
          <View style={styles.eventTagsGrid}>
            {(event.tags || []).slice(0, 6).map((tag, index) => (
              <View key={index} style={styles.eventTag}>
                <Text style={styles.eventTagText} numberOfLines={1}>{tag}</Text>
              </View>
            ))}
            {(event.tags || []).length > 6 && (
              <View style={[styles.eventTag, styles.eventTagMore]}>
                <Text style={styles.eventTagText}>+{(event.tags || []).length - 6}</Text>
              </View>
            )}
          </View>
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

export default function EventsSearchScreen() {
  const { isLoaded, toggleSaveEvent, isEventSaved } = useGroups();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showAdminModal, setShowAdminModal] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

  // Filter events when search query, tags, or events change
  useEffect(() => {
    let filtered = events;
    
    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(event => 
        event.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.date.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Apply tag filter
    if (selectedTags.length > 0) {
      filtered = filtered.filter(event => 
        selectedTags.every(tag => (event.tags || []).includes(tag))
      );
    }
    
    setFilteredEvents(filtered);
  }, [events, searchQuery, selectedTags]);

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
          time: apiEvent.time || 'TBD',
          price: apiEvent.is_free ? 'Free' : `$${apiEvent.price} ${apiEvent.currency}`,
          distance: '5 miles away',
          type: (apiEvent.category as Event['type']) || 'music',
          tags: apiEvent.tags || []
        }));
        
        setEvents(formattedEvents);
      } else {
        setEvents(getFallbackEvents());
      }
    } catch (error) {
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
    router.push({
      pathname: '/group-selection',
      params: { event: JSON.stringify(event) }
    });
  };

  // Predefined sample tags that always show
  const predefinedTags = [
    'free', 'family-friendly', 'music', 'outdoor', 'indoor', 'nightlife', 
    'food', 'exercise', 'arts', 'educational', 'social', 'entertainment'
  ];

  // Get all unique tags from events plus predefined ones
  const getAllTags = (): string[] => {
    const tagSet = new Set<string>(predefinedTags);
    events.forEach(event => {
      (event.tags || []).forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleClearAll = () => {
    setSearchQuery('');
    setSelectedTags([]);
  };

  const hasActiveFilters = searchQuery.trim() || selectedTags.length > 0;
  const allTags = getAllTags() || [];

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
        
      {/* Search Bar and Tags - Fixed at top */}
      <View style={[styles.searchTagsContainer, { paddingTop: insets.top + 10 }]}>
        {/* Header with back button and actions */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <View style={styles.topBarCenter}>
            <Text style={styles.topBarTitle}>Search Events</Text>
            <Text style={styles.topBarSubtitle}>
              {searchQuery ? `${filteredEvents.length} of ${events.length}` : `${events.length}`} event{events.length === 1 ? '' : 's'} {searchQuery ? 'found' : 'available'}
            </Text>
          </View>
          <View style={styles.topBarActions}>
            <TouchableOpacity style={styles.adminButton} onPress={() => setShowAdminModal(true)}>
              <Ionicons name="add" size={18} color="#ffffff" />
              <Text style={styles.adminButtonText}>Admin</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.refreshButton} onPress={loadEvents}>
              <Ionicons name="refresh" size={20} color="#60a5fa" />
            </TouchableOpacity>
          </View>
        </View>
        
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
            {hasActiveFilters && (
              <TouchableOpacity onPress={handleClearAll} style={styles.clearAllButton}>
                <Ionicons name="close" size={18} color="#ffffff" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Tag Filter */}
        <View style={styles.tagContainer}>
        <View style={styles.tagRowsContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.tagRow}
            contentContainerStyle={styles.tagRowContent}
          >
            {allTags.slice(0, Math.ceil(allTags.length / 2)).map((tag) => (
              <TouchableOpacity
                key={tag}
                style={[
                  styles.tagChip,
                  selectedTags.includes(tag) && styles.tagChipSelected
                ]}
                onPress={() => handleTagToggle(tag)}
              >
                <Text style={[
                  styles.tagChipText,
                  selectedTags.includes(tag) && styles.tagChipTextSelected
                ]}>
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.tagRow}
            contentContainerStyle={styles.tagRowContent}
          >
            {allTags.slice(Math.ceil(allTags.length / 2)).map((tag) => (
              <TouchableOpacity
                key={tag}
                style={[
                  styles.tagChip,
                  selectedTags.includes(tag) && styles.tagChipSelected
                ]}
                onPress={() => handleTagToggle(tag)}
              >
                <Text style={[
                  styles.tagChipText,
                  selectedTags.includes(tag) && styles.tagChipTextSelected
                ]}>
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
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
                onAddToGroup={handleAddToGroup}
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
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 16,
  },
  eventsGrid: {
    gap: 16,
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
  clearAllButton: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  tagContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  tagRowsContainer: {
    gap: 6,
  },
  tagRow: {
    height: 30,
  },
  tagRowContent: {
    paddingRight: 16,
    gap: 8,
    alignItems: 'center',
  },
  tagChip: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  tagChipSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  tagChipText: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '500',
  },
  tagChipTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
  eventTagsContainer: {
    flex: 1,
    marginHorizontal: 12,
  },
  eventTagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    maxHeight: 48,
    overflow: 'hidden',
  },
  eventTag: {
    backgroundColor: '#374151',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    width: '31%',
    alignItems: 'center',
  },
  eventTagMore: {
    backgroundColor: '#4b5563',
  },
  eventTagText: {
    fontSize: 9,
    color: '#e5e7eb',
    fontWeight: '500',
    textAlign: 'center',
  },
});