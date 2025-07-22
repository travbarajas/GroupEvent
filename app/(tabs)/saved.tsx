import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Share,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useGroups, Event, Group } from '../../contexts/GroupsContext';
import GroupSelectionModal from '../../components/GroupSelectionModal';

const { width } = Dimensions.get('window');

const EventCard = ({ event, onPress, onUnsave, onAddToGroup, onShare }: { 
  event: Event; 
  onPress: () => void;
  onUnsave: () => void;
  onAddToGroup: () => void;
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
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.shareButton} onPress={onShare}>
            <Ionicons name="share-outline" size={18} color="#9ca3af" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton} onPress={onAddToGroup}>
            <Ionicons name="add" size={18} color="#60a5fa" />
          </TouchableOpacity>
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
  const { savedEvents, setSavedEvents, setSelectedEvent, setSourceLayout } = useGroups();
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [selectedEventForGroup, setSelectedEventForGroup] = useState<Event | null>(null);

  const handleEventPress = (event: Event) => {
    setSelectedEvent(event);
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

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Saved Events</Text>
            <Text style={styles.headerSubtitle}>
              {savedEvents.length} event{savedEvents.length === 1 ? '' : 's'} saved
            </Text>
          </View>
          <TouchableOpacity style={styles.refreshButton} onPress={() => {}}>
            <Ionicons name="refresh" size={20} color="#60a5fa" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {savedEvents.length === 0 ? (
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
            {savedEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onPress={() => handleEventPress(event)}
                onUnsave={() => handleUnsaveEvent(event.id)}
                onAddToGroup={() => handleAddToGroup(event)}
                onShare={() => handleShareEvent(event)}
              />
            ))}
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
});