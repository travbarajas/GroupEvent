import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ApiService } from '../services/api';

interface Event {
  id: string;
  custom_name: string;
  original_event_data: {
    name: string;
    date: string;
    venue?: {
      name: string;
      city: string;
      state: string;
    };
    images?: Array<{
      url: string;
      width: number;
      height: number;
    }>;
  };
}

export default function DateEventsScreen() {
  const insets = useSafeAreaInsets();
  const { date, groupId } = useLocalSearchParams();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (groupId && date) {
      fetchEventsForDate();
    }
  }, [groupId, date]);

  const fetchEventsForDate = async () => {
    try {
      setLoading(true);
      const eventsData = await ApiService.getGroupEvents(groupId as string);
      
      // Filter events for the selected date
      const dateEvents = (eventsData.events || []).filter((event: Event) => {
        const eventDate = formatEventDate(event.original_event_data?.date);
        return eventDate === date;
      });
      
      setEvents(dateEvents);
    } catch (error) {
      console.error('Failed to fetch events for date:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const formatEventDate = (dateString: string): string | null => {
    if (!dateString) return null;
    
    try {
      let eventDate: Date;
      
      if (dateString.includes('FALLBACK')) {
        const match = dateString.match(/(\w+),?\s+(\w+)\s+(\d+)/);
        if (match) {
          const [, , monthName, day] = match;
          const currentYear = new Date().getFullYear();
          eventDate = new Date(`${monthName} ${day}, ${currentYear}`);
        } else {
          return null;
        }
      } else {
        eventDate = new Date(dateString);
      }
      
      if (isNaN(eventDate.getTime())) {
        return null;
      }
      
      const year = eventDate.getFullYear();
      const month = String(eventDate.getMonth() + 1).padStart(2, '0');
      const day = String(eventDate.getDate()).padStart(2, '0');
      
      return `${year}-${month}-${day}`;
    } catch (error) {
      console.error('Error formatting date:', dateString, error);
      return null;
    }
  };

  const formatDisplayDate = (dateString: string) => {
    // Parse the date string manually to avoid timezone issues
    const [year, month, day] = dateString.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day); // month is 0-indexed
    return dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const renderEvent = (event: Event) => {
    const eventData = event.original_event_data;
    const venue = eventData?.venue;
    const imageUrl = eventData?.images?.[0]?.url;

    return (
      <TouchableOpacity
        key={event.id}
        style={styles.eventCard}
        onPress={() => router.push(`/event/${event.id}?groupId=${groupId}`)}
      >
        {imageUrl && (
          <Image source={{ uri: imageUrl }} style={styles.eventImage} />
        )}
        <View style={styles.eventContent}>
          <Text style={styles.eventTitle}>
            {event.custom_name || eventData?.name || 'Untitled Event'}
          </Text>
          {venue && (
            <Text style={styles.eventVenue}>
              {venue.name} • {venue.city}, {venue.state}
            </Text>
          )}
          <Text style={styles.eventDate}>
            {eventData?.date}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#666" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Events</Text>
          <View style={styles.headerSpacer} />
        </View>
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Date Header */}
        <View style={styles.dateHeader}>
          <Text style={styles.dateTitle}>
            {date ? formatDisplayDate(date as string) : 'Selected Date'}
          </Text>
        </View>

        {/* Events List */}
        <View style={styles.eventsContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading events...</Text>
            </View>
          ) : events.length > 0 ? (
            events.map(renderEvent)
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={48} color="#666" />
              <Text style={styles.emptyTitle}>No Events</Text>
              <Text style={styles.emptySubtitle}>
                No events scheduled for this date
              </Text>
            </View>
          )}
        </View>
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
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  headerSpacer: {
    width: 40,
  },
  scrollContainer: {
    flex: 1,
  },
  dateHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  dateTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  eventsContainer: {
    padding: 16,
  },
  eventCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  eventImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  eventContent: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  eventVenue: {
    fontSize: 14,
    color: '#999',
    marginBottom: 2,
  },
  eventDate: {
    fontSize: 12,
    color: '#666',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});