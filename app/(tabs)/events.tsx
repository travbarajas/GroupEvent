import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useGroups, Event, Group } from '../../contexts/GroupsContext';
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

const EventBlock = ({ event, onPress, onAddToGroup }: { 
  event: Event; 
  onPress: (event: Event, layout: any) => void;
  onAddToGroup: (event: Event) => void;
}) => {
  const blockRef = useRef<View>(null);
  const { toggleSaveEvent, isEventSaved } = useGroups();

  const handlePress = () => {
    blockRef.current?.measure((x, y, width, height, pageX, pageY) => {
      onPress(event, { x: pageX, y: pageY, width, height });
    });
  };

  const handleSaveEvent = () => {
    toggleSaveEvent(event);
  };

  const handleAddToGroup = () => {
    onAddToGroup(event);
  };

  const isSaved = isEventSaved(event.id);

  return (
    <TouchableOpacity 
      ref={blockRef}
      style={styles.eventBlock}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <View style={styles.eventContent}>
        <View style={styles.leftContent}>
          <View style={styles.topSection}>
            <View style={styles.headerRow}>
              <View style={styles.iconContainer}>
                <EventIcon type={event.type} />
              </View>
              <View style={styles.titleDateContainer}>
                <Text style={styles.eventTitle}>{event.name}</Text>
                <Text style={styles.eventDate}>{event.date}</Text>
              </View>
            </View>
            
            <Text style={styles.description}>{event.description}</Text>
          </View>
          
          <View style={styles.detailsRow}>
            <Text style={styles.time}>{event.time}</Text>
            <Text style={styles.price}>{event.price}</Text>
            <Text style={styles.distance}>{event.distance}</Text>
          </View>
        </View>
        
        <View style={styles.buttonsContainer}>
          <TouchableOpacity 
            style={[styles.actionButton, isSaved && styles.savedButton]} 
            onPress={handleSaveEvent}
          >
            <Ionicons 
              name={isSaved ? "heart" : "heart-outline"} 
              size={20} 
              color={isSaved ? "#ef4444" : "#d1d5db"} 
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleAddToGroup}>
            <Ionicons name="add" size={20} color="#d1d5db" />
          </TouchableOpacity>
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

  const handleEventPress = (event: Event, layout: any) => {
    setSourceLayout(layout);
    setSelectedEvent(event);
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

  const events: Event[] = [
    {
      id: 1,
      name: "Summer Music Festival",
      date: "Sat, July 19",
      description: "Live bands, food trucks, and craft beer",
      time: "2:00 PM",
      price: "$15 per person",
      distance: "12 miles away",
      type: "festival"
    },
    {
      id: 2,
      name: "Jazz Night at Blue Note",
      date: "Fri, July 18",
      description: "Local jazz quartet performing classics",
      time: "7:00 PM",
      price: "$20 cover",
      distance: "3 miles away",
      type: "music"
    },
    {
      id: 3,
      name: "Hiking at Auburn State Park",
      date: "Sun, July 21",
      description: "Morning hike with scenic views",
      time: "8:00 AM",
      price: "$5 parking",
      distance: "25 miles away",
      type: "outdoor"
    }
  ];

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Extended Header */}
      <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Events</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={() => {}}>
            <Ionicons name="refresh" size={20} color="#60a5fa" />
          </TouchableOpacity>
        </View>
      </View>
      
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {events.map(event => (
          <EventBlock 
            key={event.id} 
            event={event} 
            onPress={handleEventPress}
            onAddToGroup={handleAddToGroup}
          />
        ))}
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
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  scrollContainer: {
    flex: 1,
    padding: 16,
  },
  eventBlock: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  eventContent: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 120,
  },
  leftContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topSection: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconContainer: {
    backgroundColor: '#2a2a2a',
    padding: 8,
    borderRadius: 6,
    marginRight: 12,
  },
  titleDateContainer: {
    justifyContent: 'center',
    height: 40,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    lineHeight: 20,
  },
  eventDate: {
    fontSize: 14,
    color: '#9ca3af',
    lineHeight: 18,
  },
  description: {
    fontSize: 14,
    color: '#e5e7eb',
  },
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  time: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fb923c',
  },
  price: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4ade80',
  },
  distance: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#f87171',
  },
  buttonsContainer: {
    marginLeft: 16,
    gap: 8,
  },
  actionButton: {
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  savedButton: {
    backgroundColor: '#1f2937',
    borderColor: '#ef4444',
  },
  refreshButton: {
    padding: 6,
  },
});