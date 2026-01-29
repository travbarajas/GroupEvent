import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Share,
  TextInput,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useGroups, Event, Group } from '../../contexts/GroupsContext';
import GroupSelectionModal from '../../components/GroupSelectionModal';

const { width } = Dimensions.get('window');

const EventCard = ({ event, onPress, onUnsave, onShare }: { 
  event: Event; 
  onPress: () => void;
  onUnsave: () => void;
  /* onAddToGroup: () => void; // Hidden - preserving for future use */
  onShare: () => void;
}) => {
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
          <TouchableOpacity style={styles.shareButton} onPress={onShare}>
            <Ionicons name="share-outline" size={18} color="#9ca3af" />
          </TouchableOpacity>
          {/* Add to Group button hidden - preserving functionality for future use
          <TouchableOpacity style={styles.addButton} onPress={onAddToGroup}>
            <Ionicons name="add" size={18} color="#60a5fa" />
          </TouchableOpacity>
          */}
          <TouchableOpacity style={styles.unsaveButton} onPress={onUnsave}>
            <Ionicons name="heart" size={20} color="#ef4444" />
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
          <Text style={styles.eventPrice}>{event.price || 'Free'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default function SavedTab() {
  const insets = useSafeAreaInsets();
  const { savedEvents, setSavedEvents } = useGroups();
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [selectedEventForGroup, setSelectedEventForGroup] = useState<Event | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const scrollY = useRef(new Animated.Value(0)).current;

  // Filter events when search query, tags, or saved events change
  useEffect(() => {
    let filtered = savedEvents || [];
    
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
  }, [savedEvents, searchQuery, selectedTags]);

  const handleEventPress = (event: Event) => {
    router.push({
      pathname: '/event-detail',
      params: { event: JSON.stringify(event) }
    });
  };

  const handleUnsaveEvent = (eventId: number) => {
    setSavedEvents(prev => prev.filter(event => event.id !== eventId));
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

  const handleShareEvent = async (event: Event) => {
    try {
      const shareContent = {
        message: `Check out this event: ${event.name}\n\nDate: ${event.date}\nTime: ${event.time}\nLocation: ${event.distance}\nPrice: ${event.price || 'Free'}\n\n${event.description}`,
        title: event.name,
      };
      
      await Share.share(shareContent);
    } catch (error) {
      console.error('Error sharing event:', error);
    }
  };

  // Predefined sample tags that always show
  const predefinedTags = [
    'free', 'family-friendly', 'music', 'outdoor', 'indoor', 'nightlife', 
    'food', 'exercise', 'arts', 'educational', 'social', 'entertainment'
  ];

  // Get all unique tags from saved events plus predefined ones
  const getAllTags = (): string[] => {
    const tagSet = new Set<string>(predefinedTags);
    (savedEvents || []).forEach(event => {
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

  // Handle scroll for collapsing header
  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: false }
  );

  // Create interpolated values for smooth collapse animation
  const searchTagsOpacity = scrollY.interpolate({
    inputRange: [0, 50, 100],
    outputRange: [1, 0.5, 0],
    extrapolate: 'clamp',
  });

  const searchTagsTranslateY = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, -120], // Move fully out of view
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header - Static */}
      <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Saved Events</Text>
            <Text style={styles.headerSubtitle}>
              {searchQuery ? `${filteredEvents.length} of ${(savedEvents || []).length}` : `${(savedEvents || []).length}`} event{(savedEvents || []).length === 1 ? '' : 's'} {searchQuery ? 'found' : 'saved'}
            </Text>
          </View>
          <TouchableOpacity style={styles.refreshButton} onPress={() => {}}>
            <Ionicons name="refresh" size={20} color="#60a5fa" />
          </TouchableOpacity>
        </View>
      </View>
        
      {/* Search Bar and Tags - Collapsible Overlay */}
      <Animated.View style={[
        styles.searchTagsOverlay,
        {
          top: insets.top + 88, // Slightly lower to clear header completely
          opacity: searchTagsOpacity,
          transform: [{ translateY: searchTagsTranslateY }],
        }
      ]}>
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
      </Animated.View>

      {/* Content */}
      <Animated.ScrollView 
        style={styles.scrollContainer} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {(savedEvents || []).length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="heart-outline" size={64} color="#4b5563" />
            </View>
            <Text style={styles.emptyTitle}>No Saved Events</Text>
            <Text style={styles.emptySubtitle}>
              Events you like will appear here.{'\n'}
              Tap the heart icon on any event to save it!
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
                /* onAddToGroup={() => handleAddToGroup(event)} // Hidden - preserving for future use */
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
      </Animated.ScrollView>
      
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
    zIndex: 2000, // Higher than search overlay
    elevation: 10, // Android shadow
  },
  searchTagsOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#1a1a1a',
    zIndex: 1000,
    elevation: 5, // For Android shadow
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
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 160, // Reduced space between tags and event blocks
    paddingHorizontal: 16,
    paddingBottom: 16,
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
  unsaveButton: {
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
    marginBottom: 8,
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
    padding: 4,
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