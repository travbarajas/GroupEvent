import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Share,
  Image,
  Dimensions,
  Platform,
  Linking,
  Alert,
} from 'react-native';
import * as Calendar from 'expo-calendar';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useGroups, Event } from '../contexts/GroupsContext';
import { ApiService } from '../services/api';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import AdminPasswordGate from '../components/AdminPasswordGate';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Format date to show day name if within 7 days, otherwise MM/DD/YY
const formatEventDate = (dateString: string): string => {
  if (!dateString) return '';

  // Handle date range format "YYYY-MM-DD to YYYY-MM-DD"
  const datePart = dateString.split(' to ')[0];

  // Parse the date - handle both "YYYY-MM-DD" and other formats
  let eventDate: Date;
  if (datePart.match(/^\d{4}-\d{2}-\d{2}$/)) {
    // YYYY-MM-DD format - parse as local date
    const [year, month, day] = datePart.split('-').map(Number);
    eventDate = new Date(year, month - 1, day);
  } else {
    eventDate = new Date(datePart);
  }

  if (isNaN(eventDate.getTime())) return dateString;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());

  const diffTime = eventDay.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const formattedDate = `${monthNames[eventDate.getMonth()]} ${eventDate.getDate()}`;

  // If within 7 days (including today), show just the day name
  if (diffDays === 0) {
    return 'Today';
  }
  if (diffDays === 1) {
    return 'Tomorrow';
  }
  if (diffDays > 1 && diffDays < 7) {
    return dayNames[eventDate.getDay()];
  }

  return formattedDate;
};

export default function EventDetailScreen() {
  const { toggleSaveEvent, isEventSaved, selectedEvent, setSelectedEvent } = useGroups();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const { isAdmin, passwordVerified, verifyPassword } = useIsAdmin();

  // Prefer context (fast, no serialization) — fall back to params for edge cases
  const event: Event | null = selectedEvent ?? (params.event ? JSON.parse(params.event as string) : null);

  const [imageHeight, setImageHeight] = useState(SCREEN_WIDTH * (9 / 16));

  useEffect(() => {
    if (event?.image_url) {
      Image.getSize(event.image_url, (w, h) => {
        setImageHeight(SCREEN_WIDTH * (h / w));
      }, () => {});
    }
  }, [event?.image_url]);

  useEffect(() => {
    return () => setSelectedEvent(null);
  }, []);

  useEffect(() => {
    if (event) {
      const source = (params.source as string) || undefined;
      ApiService.trackEvent('page_view', 'event', String(event.id), {
        target_name: event.name,
        source,
      });
    }
  }, [event?.id]);

  if (!event) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={[styles.errorHeader, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.circleButton}>
            <Ionicons name="arrow-back" size={22} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.errorHeaderTitle}>Event Not Found</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Event details not available</Text>
        </View>
      </View>
    );
  }

  const handleSaveEvent = () => {
    if (!isEventSaved(event.id)) {
      ApiService.trackEvent('save', 'event', String(event.id), { target_name: event.name, source: 'detail' });
    }
    toggleSaveEvent(event);
  };

  const handleShare = async () => {
    try {
      const shareContent = {
        message: `Check out this event: ${event.name}\n\nDate: ${event.date}\nTime: ${event.time}\nLocation: ${event.venue_name && event.location ? `${event.venue_name}, ${event.location}` : event.venue_name || event.location || ''}\nPrice: ${event.price}\n\n${event.description}`,
        title: event.name,
      };

      await Share.share(shareContent);
    } catch (error) {
      console.error('Error sharing event:', error);
    }
  };

  const handleAddToGroup = () => {
    router.push({
      pathname: '/group-selection',
      params: { event: JSON.stringify(event) }
    });
  };

  const handleEditEvent = () => {
    // Navigate to edit event modal with event data
    router.push({
      pathname: '/edit-event',
      params: { event: JSON.stringify(event) }
    });
  };

  const getDirectionsAddress = () => {
    const address = event.location || event.venue_name;
    return address ? encodeURIComponent(address) : null;
  };

  const handleAppleMaps = () => {
    const encoded = getDirectionsAddress();
    if (!encoded) return;
    Linking.openURL(`maps://?daddr=${encoded}`);
  };

  const handleGoogleMaps = () => {
    const encoded = getDirectionsAddress();
    if (!encoded) return;
    Linking.openURL(`https://maps.google.com/?daddr=${encoded}`);
  };

  const handleAddToCalendar = async () => {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow calendar access in Settings to add events.');
      return;
    }

    const datePart = event.date?.split(' to ')[0];
    if (!datePart?.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert('Could not add event', 'Event date format not recognized.');
      return;
    }

    const [year, month, day] = datePart.split('-').map(Number);
    const startDate = new Date(year, month - 1, day, 9, 0, 0);
    const endDate = new Date(year, month - 1, day, 10, 0, 0);

    if (event.time) {
      const range = event.time.match(/(\d+):(\d+)\s*(AM|PM)\s*-\s*(\d+):(\d+)\s*(AM|PM)/i);
      if (range) {
        let sh = parseInt(range[1]), sm = parseInt(range[2]);
        if (range[3].toUpperCase() === 'PM' && sh !== 12) sh += 12;
        if (range[3].toUpperCase() === 'AM' && sh === 12) sh = 0;
        startDate.setHours(sh, sm, 0);

        let eh = parseInt(range[4]), em = parseInt(range[5]);
        if (range[6].toUpperCase() === 'PM' && eh !== 12) eh += 12;
        if (range[6].toUpperCase() === 'AM' && eh === 12) eh = 0;
        endDate.setHours(eh, em, 0);
      } else {
        const m = event.time.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (m) {
          let h = parseInt(m[1]);
          const min = parseInt(m[2]);
          if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12;
          if (m[3].toUpperCase() === 'AM' && h === 12) h = 0;
          startDate.setHours(h, min, 0);
          endDate.setTime(startDate.getTime() + 60 * 60 * 1000);
        }
      }
    }

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const writable = calendars.find((c) => c.allowsModifications);
    if (!writable) {
      Alert.alert('No calendar found', 'Could not find a writable calendar.');
      return;
    }

    await Calendar.createEventAsync(writable.id, {
      title: event.name,
      startDate,
      endDate,
      location: event.venue_name && event.location
        ? `${event.venue_name}, ${event.location}`
        : event.venue_name || event.location || '',
      notes: event.description || '',
    });

    Alert.alert('Added to Calendar', `"${event.name}" was added to your calendar.`);
  };

  const isSaved = isEventSaved(event.id);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Fixed header — always visible, never scrolls */}
      <View style={[styles.fixedHeader, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.circleButton}>
          <Ionicons name="arrow-back" size={26} color="#ffffff" />
        </TouchableOpacity>
        {isAdmin && (
          <TouchableOpacity onPress={handleEditEvent} style={styles.circleButton}>
            <Ionicons name="create-outline" size={20} color="#ffffff" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={[styles.scrollContainer, { paddingTop: insets.top + 40 }]} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }} showsVerticalScrollIndicator={false}>
        {/* Hero Image */}
        <View style={[styles.imageWrapper, { height: imageHeight }]}>
          {event.image_url ? (
            <Image source={{ uri: event.image_url }} style={styles.heroImage} resizeMode="contain" />
          ) : (
            <Image source={{ uri: 'https://picsum.photos/800/400' }} style={styles.heroImage} resizeMode="contain" />
          )}

          {isAdmin && (
            <View />
          )}
        </View>

        <View style={styles.imageDivider} />

        {/* Event Name & Date */}
        <View style={styles.titleSection}>
          <Text style={styles.eventName}>{event.name}</Text>
          <Text style={styles.eventDate}>{formatEventDate(event.date)}</Text>
        </View>

        {/* Time / Location / Price - Stacked */}
        <View style={styles.detailsList}>
          <View style={styles.detailRow}>
            <Ionicons name="time" size={18} color="#60a5fa" />
            <Text style={styles.detailLabel}>Time</Text>
            <Text style={styles.detailValue}>{event.time || '—'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="location" size={18} color="#f87171" />
            <Text style={styles.detailLabel}>Location</Text>
            <Text style={styles.detailValue}>
              {event.venue_name && event.location
                ? `${event.venue_name}, ${event.location}`
                : event.venue_name || event.location || '—'}
            </Text>
          </View>
          {(event.price && String(event.price) !== '0' && String(event.price) !== '0.00') && (
            <View style={styles.detailRow}>
              <Ionicons name="card" size={18} color="#4ade80" />
              <Text style={styles.detailLabel}>Price</Text>
              <Text style={styles.detailValue}>{event.price}</Text>
            </View>
          )}
        </View>

        {/* Description */}
        {(event.description || event.website_url) ? (
          <View style={styles.section}>
            {event.description ? (
              <>
                <Text style={styles.sectionLabel}>About this event</Text>
                <Text style={styles.eventDescription}>{event.description}</Text>
              </>
            ) : null}
            {event.website_url ? (
              <TouchableOpacity
                style={[styles.websiteButton, !event.description && { marginTop: 0 }]}
                onPress={() => Linking.openURL(event.website_url!)}
              >
                <Ionicons name="globe-outline" size={16} color="#ffffff" />
                <Text style={styles.websiteButtonText}>{event.link_label || 'Learn More'}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Location</Text>
          {(event.location || event.venue_name) ? (
            <View style={styles.locationCard}>
              <View style={styles.locationCardRow}>
                <Ionicons name="location" size={18} color="#f87171" />
                <Text style={styles.addressText}>
                  {event.venue_name && event.location
                    ? `${event.venue_name}, ${event.location}`
                    : event.venue_name || event.location}
                </Text>
              </View>
              <View style={styles.directionsRow}>
                <TouchableOpacity style={styles.directionsButton} onPress={handleAppleMaps}>
                  <Ionicons name="navigate" size={16} color="#ffffff" />
                  <Text style={styles.directionsButtonText}>Apple Maps</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.directionsButton} onPress={handleGoogleMaps}>
                  <Ionicons name="navigate" size={16} color="#ffffff" />
                  <Text style={styles.directionsButtonText}>Google Maps</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.placeholderMap}>
              <Ionicons name="map-outline" size={32} color="#6b7280" />
              <Text style={styles.placeholderMapText}>No location provided</Text>
            </View>
          )}
        </View>

        {/* Tags */}
        {event.tags && event.tags.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Tags</Text>
            <View style={styles.tagsContainer}>
              {event.tags.map((tag, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <AdminPasswordGate
        visible={isAdmin && !passwordVerified}
        onVerify={verifyPassword}
      />

      {/* Action Buttons */}
      <View style={[styles.actionButtons, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.saveButton,
            isSaved && styles.savedButton
          ]}
          onPress={handleSaveEvent}
        >
          <Ionicons
            name={isSaved ? "heart" : "heart-outline"}
            size={18}
            color={isSaved ? "#ef4444" : "#9ca3af"}
          />
          <Text style={[
            styles.actionButtonText,
            isSaved && styles.savedButtonText
          ]}>
            {isSaved ? 'Saved' : 'Save'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButton, styles.calendarButton]} onPress={handleAddToCalendar}>
          <Ionicons name="calendar-outline" size={18} color="#9ca3af" />
          <Text style={styles.actionButtonText}>Calendar</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButton, styles.shareButton]} onPress={handleShare}>
          <Ionicons name="share-outline" size={18} color="#9ca3af" />
          <Text style={styles.actionButtonText}>Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  fixedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 4,
    paddingRight: 16,
    paddingBottom: 6,
    paddingTop: 6,
    backgroundColor: '#0a0a0a',
  },
  scrollContainer: {
    flex: 1,
  },

  // Hero image
  imageWrapper: {
    width: SCREEN_WIDTH,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1a1a1a',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Circle overlay buttons
  circleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonOverlay: {
    position: 'absolute',
    left: 16,
  },
  editButtonOverlay: {
    position: 'absolute',
    right: 16,
  },

  // Title section
  imageDivider: {
    height: 1,
    backgroundColor: '#2a2a2a',
  },
  titleSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 4,
  },

  // Stacked details list
  detailsList: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: '#9ca3af',
    fontWeight: '500',
    marginLeft: 10,
    width: 70,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#e5e7eb',
    flex: 1,
  },
  eventName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  eventDate: {
    fontSize: 16,
    color: '#9ca3af',
    fontWeight: '500',
  },

  // Generic section
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  eventDescription: {
    fontSize: 15,
    color: '#e5e7eb',
    lineHeight: 22,
  },
  websiteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#2563eb',
    borderRadius: 10,
  },
  websiteButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },

  // Location card
  locationCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3a3a3a',
    padding: 14,
    gap: 12,
  },
  locationCardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  addressText: {
    fontSize: 14,
    color: '#e5e7eb',
    flex: 1,
    lineHeight: 20,
  },
  directionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  directionsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: '#2563eb',
    borderRadius: 8,
  },
  directionsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  placeholderMap: {
    height: 120,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3a3a3a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderMapText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
    marginTop: 8,
  },

  // Tags
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  tagText: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },

  // Action buttons
  actionButtons: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 6,
  },
  saveButton: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  savedButton: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  calendarButton: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  shareButton: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e5e7eb',
  },
  savedButtonText: {
    color: '#ef4444',
  },

  // Error state
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1a1a1a',
    gap: 12,
  },
  errorHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#9ca3af',
  },
});
