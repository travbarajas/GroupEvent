import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useGroups, Event } from '../contexts/GroupsContext';

export default function EventDetailScreen() {
  const { toggleSaveEvent, isEventSaved } = useGroups();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  
  // Parse the event data from params
  const event: Event | null = params.event ? JSON.parse(params.event as string) : null;

  if (!event) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Event Not Found</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Event details not available</Text>
        </View>
      </View>
    );
  }

  const handleSaveEvent = () => {
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

  const isSaved = isEventSaved(event.id);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Safe area background extension */}
      <View style={[styles.safeAreaBackground, { height: insets.top }]} />
      
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Event Header */}
        <View style={[styles.eventHeader, { paddingTop: insets.top + 20 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <View style={[styles.eventTypeIcon, { backgroundColor: getTypeColor(event.type) }]}>
            <Ionicons name={getTypeIcon(event.type)} size={24} color="#ffffff" />
          </View>
          <View style={styles.eventHeaderText}>
            <Text style={styles.eventName}>{event.name}</Text>
            <Text style={styles.eventDate}>{event.date}</Text>
          </View>
        </View>

        {/* Event Details Grid */}
        <View style={styles.detailsContainer}>
          <View style={styles.detailsGrid}>
            <View style={styles.detailColumn}>
              <View style={styles.detailIcon}>
                <Ionicons name="time" size={16} color="#fb923c" />
              </View>
              <Text style={styles.detailLabel}>Time</Text>
              <Text style={styles.detailValue}>{event.time}</Text>
            </View>
            
            <View style={styles.detailColumn}>
              <View style={styles.detailIcon}>
                <Ionicons name="location" size={16} color="#f87171" />
              </View>
              <Text style={styles.detailLabel}>Distance</Text>
              <Text style={styles.detailValue}>{event.distance}</Text>
            </View>
            
            <View style={styles.detailColumn}>
              <View style={styles.detailIcon}>
                <Ionicons name="card" size={16} color="#4ade80" />
              </View>
              <Text style={styles.detailLabel}>Price</Text>
              <Text style={styles.detailValue}>{event.price}</Text>
            </View>
          </View>
        </View>

        {/* Event Image */}
        <View style={styles.imageSection}>
          <View style={styles.placeholderImage}>
            <Ionicons name="image-outline" size={40} color="#6b7280" />
            <Text style={styles.placeholderImageText}>Event Photo</Text>
          </View>
        </View>

        {/* Description */}
        <View style={styles.descriptionSection}>
          <Text style={styles.descriptionLabel}>About this event</Text>
          <Text style={styles.eventDescription}>
            {event.description}
          </Text>
        </View>

        {/* Map Section */}
        <View style={styles.mapSection}>
          <Text style={styles.mapLabel}>Location</Text>
          <View style={styles.placeholderMap}>
            <Ionicons name="map-outline" size={32} color="#6b7280" />
            <Text style={styles.placeholderMapText}>Map View</Text>
          </View>
          <View style={styles.addressContainer}>
            <Ionicons name="location" size={16} color="#f87171" />
            <Text style={styles.addressText}>123 Main Street, Downtown District, San Francisco, CA 94102</Text>
          </View>
        </View>

        {/* Tags */}
        {event.tags && event.tags.length > 0 && (
          <View style={styles.tagsSection}>
            <Text style={styles.tagsLabel}>Tags</Text>
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
        
        <TouchableOpacity style={[styles.actionButton, styles.addButton]} onPress={handleAddToGroup}>
          <Ionicons name="add" size={18} color="#ffffff" />
          <Text style={styles.actionButtonText}>Add to Group</Text>
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
  safeAreaBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1a1a1a',
    zIndex: 1,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  scrollContainer: {
    flex: 1,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  eventTypeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  eventHeaderText: {
    flex: 1,
  },
  eventName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 3,
    lineHeight: 24,
  },
  eventDate: {
    fontSize: 15,
    color: '#9ca3af',
    fontWeight: '500',
  },
  detailsContainer: {
    padding: 20,
  },
  detailsGrid: {
    flexDirection: 'row',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#3a3a3a',
    gap: 16,
  },
  detailColumn: {
    flex: 1,
    alignItems: 'center',
  },
  detailIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
    marginBottom: 4,
    textAlign: 'center',
  },
  detailValue: {
    fontSize: 14,
    color: '#e5e7eb',
    fontWeight: '600',
    textAlign: 'center',
  },
  imageSection: {
    padding: 20,
    paddingTop: 8,
  },
  placeholderImage: {
    height: 200,
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#3a3a3a',
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed',
  },
  placeholderImageText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
    marginTop: 8,
  },
  descriptionSection: {
    padding: 20,
    paddingTop: 8,
  },
  descriptionLabel: {
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
  mapSection: {
    padding: 20,
    paddingTop: 8,
  },
  mapLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  placeholderMap: {
    height: 120,
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
  tagsSection: {
    padding: 20,
    paddingTop: 8,
    paddingBottom: 120,
  },
  tagsLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
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
  addButton: {
    backgroundColor: '#2563eb',
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