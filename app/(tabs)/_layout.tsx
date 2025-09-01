import { Tabs } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Modal, View, TouchableOpacity, Text, StyleSheet, Dimensions, Animated, Share, ScrollView, Image } from 'react-native';
import { useGroups, Event, Group } from '../../contexts/GroupsContext';
import { useRouter, usePathname } from 'expo-router';
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

const ExpandedEventModal = ({ event, visible, onClose, sourceLayout, onSaveEvent, onAddToGroup, onShare }: {
  event: Event | null;
  visible: boolean;
  onClose: () => void;
  sourceLayout: any;
  onSaveEvent: () => void;
  onAddToGroup?: () => void;
  onShare?: () => void;
}) => {
  const { isEventSaved } = useGroups();
  
  const getEventTypeColor = (type: Event['type']) => {
    const colors = {
      festival: '#8b5cf6',
      music: '#06b6d4',
      outdoor: '#10b981',
      food: '#f59e0b',
    };
    return colors[type] || '#6b7280';
  };
  
  const getEventTypeIcon = (type: Event['type']) => {
    const icons = {
      festival: 'musical-notes',
      music: 'musical-note',
      outdoor: 'trail-sign',
      food: 'restaurant',
    };
    return icons[type] || 'calendar';
  };
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const translateXAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;
  const [currentEventId, setCurrentEventId] = useState<number | null>(null);

  React.useEffect(() => {
    if (event && visible) {
      // New event selected - animate in
      setCurrentEventId(event.id);
      
      // Use sourceLayout if available, otherwise center
      if (sourceLayout) {
        const screenCenterX = width / 2;
        const screenCenterY = height / 2;
        const sourceCenterX = sourceLayout.x + sourceLayout.width / 2;
        const sourceCenterY = sourceLayout.y + sourceLayout.height / 2;

        translateXAnim.setValue(sourceCenterX - screenCenterX);
        translateYAnim.setValue(sourceCenterY - screenCenterY);
        scaleAnim.setValue(0.1);
        opacityAnim.setValue(0);
      } else {
        // Simple center animation when no source layout
        translateXAnim.setValue(0);
        translateYAnim.setValue(0);
        scaleAnim.setValue(0.8);
        opacityAnim.setValue(0);
      }

      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(translateXAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(translateYAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (!event) {
      // Reset when no event is selected
      setCurrentEventId(null);
    }
  }, [event, sourceLayout, currentEventId]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  if (!visible) return null;

  return (
    <View style={styles.modalOverlay} pointerEvents="box-none">
      <Animated.View 
        style={[
          styles.modalContent,
          {
            transform: [
              { scale: scaleAnim },
              { translateX: translateXAnim },
              { translateY: translateYAnim },
            ],
            opacity: opacityAnim,
            backgroundColor: '#1a1a1a',
          }
        ]}
        pointerEvents="auto"
      >
        {/* Close Button */}
        <TouchableOpacity onPress={handleClose} style={styles.closeButton} activeOpacity={0.8}>
          <Ionicons name="close" size={20} color="#9ca3af" />
        </TouchableOpacity>
        
        {/* Scrollable Content */}
        <ScrollView style={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
          {/* Event Header */}
          <View style={styles.modalEventHeader}>
            <View style={[styles.eventTypeIconLarge, { backgroundColor: getEventTypeColor(event?.type) }]}>
              <Ionicons name={getEventTypeIcon(event?.type)} size={24} color="#ffffff" />
            </View>
            <View style={styles.eventHeaderText}>
              <Text style={styles.modalEventName}>{event?.name}</Text>
              <Text style={styles.modalEventDate}>{event?.date}</Text>
            </View>
          </View>
          
          {/* Event Details */}
          <View style={styles.modalEventDetails}>
            <View style={styles.detailsGrid}>
              <View style={styles.detailColumn}>
                <View style={styles.detailIcon}>
                  <Ionicons name="time" size={16} color="#fb923c" />
                </View>
                <Text style={styles.detailLabel}>Time</Text>
                <Text style={styles.detailValue}>{event?.time}</Text>
              </View>
              
              <View style={styles.detailColumn}>
                <View style={styles.detailIcon}>
                  <Ionicons name="location" size={16} color="#f87171" />
                </View>
                <Text style={styles.detailLabel}>Distance</Text>
                <Text style={styles.detailValue}>{event?.distance}</Text>
              </View>
              
              <View style={styles.detailColumn}>
                <View style={styles.detailIcon}>
                  <Ionicons name="card" size={16} color="#4ade80" />
                </View>
                <Text style={styles.detailLabel}>Price</Text>
                <Text style={styles.detailValue}>{event?.price}</Text>
              </View>
            </View>
          </View>
          
          {/* Event Image */}
          <View style={styles.modalImageSection}>
            {event?.image_url ? (
              <Image source={{ uri: event.image_url }} style={styles.eventImage} />
            ) : (
              <View style={styles.placeholderImage}>
                <Ionicons name="image-outline" size={32} color="#6b7280" />
                <Text style={styles.placeholderImageText}>Event Photo</Text>
              </View>
            )}
          </View>
          
          {/* Description */}
          <View style={styles.modalDescriptionSection}>
            <Text style={styles.descriptionLabel}>About this event</Text>
            <Text style={styles.modalEventDescription}>
              {event?.description}
            </Text>
          </View>
          
          {/* Map Section */}
          <View style={styles.modalMapSection}>
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
        </ScrollView>
        
        {/* Action Buttons */}
        <View style={styles.modalActionButtons}>
          <TouchableOpacity 
            style={[
              styles.actionButton,
              styles.saveButton,
              event && isEventSaved(event.id) && styles.savedButton
            ]}
            onPress={onSaveEvent}
          >
            <Ionicons 
              name={event && isEventSaved(event.id) ? "heart" : "heart-outline"} 
              size={18} 
              color={event && isEventSaved(event.id) ? "#ef4444" : "#9ca3af"} 
            />
            <Text style={[
              styles.actionButtonText,
              event && isEventSaved(event.id) && styles.savedButtonText
            ]}>
              {event && isEventSaved(event.id) ? 'Saved' : 'Save'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.actionButton, styles.addButton]} onPress={onAddToGroup}>
            <Ionicons name="add" size={18} color="#ffffff" />
            <Text style={styles.actionButtonText}>Add to Group</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.actionButton, styles.shareButton]} onPress={onShare}>
            <Ionicons name="share-outline" size={18} color="#9ca3af" />
            <Text style={styles.actionButtonText}>Share</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

export default function TabLayout() {
  const { selectedEvent, sourceLayout, setSelectedEvent, setSourceLayout, toggleSaveEvent, isEventSaved } = useGroups();
  const pathname = usePathname();
  const router = useRouter();
  const [showGroupModal, setShowGroupModal] = React.useState(false);
  
  const handleCloseModal = () => {
    setSelectedEvent(null);
    setSourceLayout(null);
  };

  const handleSaveEvent = () => {
    if (selectedEvent) {
      toggleSaveEvent(selectedEvent);
    }
  };

  const handleAddToGroup = () => {
    if (selectedEvent) {
      setShowGroupModal(true);
    }
  };

  const handleGroupSelected = (group: Group, event: Event) => {
    // Close both modals
    setShowGroupModal(false);
    setSelectedEvent(null);
    setSourceLayout(null);
    
    // Navigate to group page with event data
    router.push({
      pathname: '/group/[id]',
      params: { 
        id: group.id,
        pendingEvent: JSON.stringify(event)
      }
    });
  };

  const handleShare = async () => {
    if (selectedEvent) {
      try {
        const shareContent = {
          message: `Check out this event: ${selectedEvent.name}\n\nDate: ${selectedEvent.date}\nTime: ${selectedEvent.time}\nLocation: ${selectedEvent.distance}\nPrice: ${selectedEvent.price}\n\n${selectedEvent.description}`,
          title: selectedEvent.name,
        };
        
        await Share.share(shareContent);
      } catch (error) {
        console.error('Error sharing event:', error);
      }
    }
  };

  // Show modal on both events and saved tabs, but not when search modal might be open
  const shouldShowModal = !!selectedEvent && (pathname.includes('events') || pathname.includes('saved'));

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#1a1a1a',
            borderTopColor: '#2a2a2a',
            borderTopWidth: 1,
            paddingBottom: 8,
            height: 90,
          },
          tabBarActiveTintColor: '#60a5fa',
          tabBarInactiveTintColor: '#9ca3af',
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Groups',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'people' : 'people-outline'} size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="newsletter"
          options={{
            title: 'Today',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'today' : 'today-outline'} size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="events"
          options={{
            title: 'Explore',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'compass' : 'compass-outline'} size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="saved"
          options={{
            title: 'Saved',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'heart' : 'heart-outline'} size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="ai"
          options={{
            title: 'AI',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'sparkles' : 'sparkles-outline'} size={24} color={color} />
            ),
          }}
        />
      </Tabs>
      
      <ExpandedEventModal 
        event={selectedEvent}
        visible={shouldShowModal}
        onClose={handleCloseModal}
        sourceLayout={sourceLayout}
        onSaveEvent={handleSaveEvent}
        onAddToGroup={handleAddToGroup}
        onShare={handleShare}
      />
      
      <GroupSelectionModal
        visible={showGroupModal}
        onClose={() => setShowGroupModal(false)}
        event={selectedEvent!}
        onGroupSelected={handleGroupSelected}
      />
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 90,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    width: width - 32,
    height: height - 200,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
    overflow: 'hidden',
  },
  modalScrollContent: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  modalEventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    backgroundColor: '#1a1a1a',
  },
  eventTypeIconLarge: {
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
  modalEventName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 3,
    lineHeight: 24,
  },
  modalEventDate: {
    fontSize: 15,
    color: '#9ca3af',
    fontWeight: '500',
  },
  modalEventDetails: {
    padding: 20,
    paddingTop: 16,
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
  modalImageSection: {
    padding: 20,
    paddingTop: 8,
  },
  eventImage: {
    width: '100%',
    height: 140,
    borderRadius: 16,
    backgroundColor: '#2a2a2a',
  },
  placeholderImage: {
    height: 140,
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
  modalMapSection: {
    padding: 20,
    paddingTop: 8,
    paddingBottom: 100,
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
  modalDescriptionSection: {
    padding: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  descriptionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  modalEventDescription: {
    fontSize: 15,
    color: '#e5e7eb',
    lineHeight: 22,
  },
  modalActionButtons: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
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
    justifyContent: 'center',
  },
  savedButton: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  addButton: {
    backgroundColor: '#2563eb',
    justifyContent: 'center',
  },
  shareButton: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#3a3a3a',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e5e7eb',
  },
  savedButtonText: {
    color: '#ef4444',
  },
});