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
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useGroups, Event } from '../contexts/GroupsContext';
import { ApiService } from '../services/api';
import { useIsAdmin } from '@/hooks/useIsAdmin';

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
  const month = (eventDate.getMonth() + 1).toString().padStart(2, '0');
  const day = eventDate.getDate().toString().padStart(2, '0');
  const year = eventDate.getFullYear().toString().slice(-2);
  const formattedDate = `${month}/${day}/${year}`;

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
  const { toggleSaveEvent, isEventSaved } = useGroups();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const { isAdmin } = useIsAdmin();

  const [imageHeight, setImageHeight] = useState(SCREEN_WIDTH);

  // Parse the event data from params
  const event: Event | null = params.event ? JSON.parse(params.event as string) : null;

  useEffect(() => {
    const imageUrl = event?.image_url || 'https://picsum.photos/800/400';
    Image.getSize(imageUrl, (width, height) => {
      setImageHeight(SCREEN_WIDTH * (height / width));
    }, () => {
      setImageHeight(SCREEN_WIDTH);
    });
  }, [event?.image_url]);

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
        message: `Check out this event: ${event.name}\n\nDate: ${event.date}\nTime: ${event.time}\nLocation: ${event.distance}\nPrice: ${event.price}\n\n${event.description}`,
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

  const isSaved = isEventSaved(event.id);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Hero Image */}
        <View style={[styles.imageWrapper, { height: imageHeight + insets.top, paddingTop: insets.top }]}>
          {event.image_url ? (
            <Image source={{ uri: event.image_url }} style={styles.heroImage} resizeMode="contain" />
          ) : (
            <Image source={{ uri: 'https://picsum.photos/800/400' }} style={styles.heroImage} resizeMode="contain" />
          )}

          {/* Overlay buttons on image */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.circleButton, styles.backButtonOverlay, { top: insets.top + 8 }]}
          >
            <Ionicons name="arrow-back" size={22} color="#ffffff" />
          </TouchableOpacity>

          {isAdmin && (
            <TouchableOpacity
              onPress={handleEditEvent}
              style={[styles.circleButton, styles.editButtonOverlay, { top: insets.top + 8 }]}
            >
              <Ionicons name="create-outline" size={20} color="#ffffff" />
            </TouchableOpacity>
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
            <Text style={styles.detailValue}>{event.distance || '—'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="card" size={18} color="#4ade80" />
            <Text style={styles.detailLabel}>Price</Text>
            <Text style={styles.detailValue}>{event.price || 'Free'}</Text>
          </View>
        </View>

        {/* Description */}
        {event.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>About this event</Text>
            <Text style={styles.eventDescription}>{event.description}</Text>
          </View>
        ) : null}

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Location</Text>
          {(event.location || event.venue_name) ? (() => {
            const query = encodeURIComponent(event.location);
            const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
            const mapUrl = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${query}`;

            return (
              <>
                <View style={styles.mapContainer}>
                  {Platform.OS === 'web' ? (
                    <iframe
                      src={mapUrl}
                      style={{ width: '100%', height: '100%', border: 'none', borderRadius: 12 } as any}
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  ) : (
                    <WebView
                      source={{ uri: mapUrl }}
                      style={{ flex: 1 }}
                      scrollEnabled={false}
                      nestedScrollEnabled={false}
                    />
                  )}
                </View>
                <View style={styles.addressContainer}>
                  <Ionicons name="location" size={16} color="#f87171" />
                  <Text style={styles.addressText}>
                    {event.venue_name && event.location
                      ? `${event.venue_name}, ${event.location}`
                      : event.venue_name || event.location}
                  </Text>
                </View>
              </>
            );
          })() : (
            <View style={styles.placeholderMap}>
              <Ionicons name="map-outline" size={32} color="#6b7280" />
              <Text style={styles.placeholderMapText}>No location provided</Text>
            </View>
          )}
        </View>

        {/* Tags */}
        {event.tags && event.tags.length > 0 && (
          <View style={[styles.section, { paddingBottom: 120 }]}>
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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

  // Map
  mapContainer: {
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#2a2a2a',
  },
  placeholderMap: {
    height: 180,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3a3a3a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  placeholderMapText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
    marginTop: 8,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  addressText: {
    fontSize: 14,
    color: '#e5e7eb',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
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
    paddingVertical: 14,
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
