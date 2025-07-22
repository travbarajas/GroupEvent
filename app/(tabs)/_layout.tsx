import { Tabs } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Modal, View, TouchableOpacity, Text, StyleSheet, Dimensions, Animated } from 'react-native';
import { useGroups, Event } from '../../contexts/GroupsContext';
import { useRouter, usePathname } from 'expo-router';

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

const ExpandedEventModal = ({ event, visible, onClose, sourceLayout, onSaveEvent }: {
  event: Event | null;
  visible: boolean;
  onClose: () => void;
  sourceLayout: any;
  onSaveEvent: () => void;
}) => {
  const { isEventSaved } = useGroups();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const translateXAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;
  const [currentEventId, setCurrentEventId] = useState<number | null>(null);

  React.useEffect(() => {
    if (event && event.id !== currentEventId && sourceLayout) {
      // New event selected - animate in
      setCurrentEventId(event.id);
      
      const screenCenterX = width / 2;
      const screenCenterY = height / 2;
      const sourceCenterX = sourceLayout.x + sourceLayout.width / 2;
      const sourceCenterY = sourceLayout.y + sourceLayout.height / 2;

      // Start from source position and scale
      translateXAnim.setValue(sourceCenterX - screenCenterX);
      translateYAnim.setValue(sourceCenterY - screenCenterY);
      scaleAnim.setValue(0.1);
      opacityAnim.setValue(0);

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
        {/* Header Bar - Entire bar is clickable to close */}
        <TouchableOpacity onPress={handleClose} style={styles.modalHeaderBar} activeOpacity={0.8}>
          <View style={styles.closeIconContainer}>
            <Ionicons name="close" size={24} color="#9ca3af" />
          </View>
        </TouchableOpacity>
        
        {/* Event Details */}
        <View style={styles.modalEventInfo}>
          <Text style={styles.modalEventName}>{event?.name}</Text>
          <Text style={styles.modalEventDate}>date - "{event?.date}"</Text>
          <Text style={styles.modalEventTime}>time - {event?.time}</Text>
          <Text style={styles.modalEventLocation}>location - {event?.distance}</Text>
          <Text style={styles.modalEventDescription}>{event?.description}</Text>
        </View>
        
        {/* Bottom Buttons */}
        <View style={styles.modalBottomButtons}>
          <TouchableOpacity 
            style={[
              styles.modalButton, 
              event && isEventSaved(event.id) && styles.modalSavedButton
            ]}
            onPress={onSaveEvent}
          >
            <Ionicons 
              name={event && isEventSaved(event.id) ? "heart" : "heart-outline"} 
              size={20} 
              color={event && isEventSaved(event.id) ? "#ef4444" : "#ffffff"} 
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalButton}>
            <Ionicons name="add" size={20} color="#ffffff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalButton}>
            <Ionicons name="arrow-redo" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

export default function TabLayout() {
  const { selectedEvent, sourceLayout, setSelectedEvent, setSourceLayout, toggleSaveEvent, isEventSaved } = useGroups();
  const pathname = usePathname();
  
  const handleCloseModal = () => {
    setSelectedEvent(null);
    setSourceLayout(null);
  };

  const handleSaveEvent = () => {
    if (selectedEvent) {
      toggleSaveEvent(selectedEvent);
    }
  };

  // Only show modal when on events tab
  const shouldShowModal = !!selectedEvent && pathname.includes('events');

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#1f2937',
            borderTopColor: '#374151',
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
          name="events"
          options={{
            title: 'Events',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={24} color={color} />
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
      </Tabs>
      
      <ExpandedEventModal 
        event={selectedEvent}
        visible={shouldShowModal}
        onClose={handleCloseModal}
        sourceLayout={sourceLayout}
        onSaveEvent={handleSaveEvent}
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
    bottom: 100,
    justifyContent: 'flex-start',
    alignItems: 'center',
    backgroundColor: 'transparent',
    zIndex: 1000,
    paddingTop: 60,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    width: width - 20,
    height: height - 220,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  modalHeaderBar: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#3a3a3a',
    minHeight: 80,
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  closeIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalEventInfo: {
    padding: 20,
    flex: 1,
  },
  modalEventName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
  },
  modalEventDate: {
    fontSize: 16,
    color: '#9ca3af',
    marginBottom: 8,
  },
  modalEventTime: {
    fontSize: 16,
    color: '#fb923c',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalEventLocation: {
    fontSize: 16,
    color: '#f87171',
    fontWeight: 'bold',
    marginBottom: 12,
  },
  modalEventDescription: {
    fontSize: 16,
    color: '#e5e7eb',
    lineHeight: 22,
  },
  modalBottomButtons: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  modalButton: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  modalSavedButton: {
    backgroundColor: '#1f2937',
    borderColor: '#ef4444',
  },
});