import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNewsletter } from '@/contexts/NewsletterContext';
import { useGroups, Event } from '@/contexts/GroupsContext';
import { Newsletter, NewsletterEvent } from '@/types/newsletter';
import { ApiService } from '@/services/api';

interface EnhancedNewsletterCreationModalProps {
  visible: boolean;
  onClose: () => void;
  onNewsletterCreated: (newsletter: Newsletter) => void;
}

export default function EnhancedNewsletterCreationModal({
  visible,
  onClose,
  onNewsletterCreated,
}: EnhancedNewsletterCreationModalProps) {
  const { createNewsletter, updateNewsletter } = useNewsletter();
  const { groups } = useGroups();
  
  const [title, setTitle] = useState('');
  const [generateEvents, setGenerateEvents] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const formatDateForDisplay = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatDateForEvent = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
    const monthDay = date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
    return `${weekday} – ${monthDay}`;
  };

  // Function to get real events for date range
  const getEventsForDateRange = async (start: string, end: string): Promise<NewsletterEvent[]> => {
    try {
      // Try to fetch events from API first
      let events: Event[] = [];
      
      try {
        const response = await fetch('https://api.communitycalendar.dev/events');
        const data = await response.json();
        events = data.events || [];
      } catch (apiError) {
        // Fallback to hardcoded events if API fails
        events = getFallbackEvents();
      }

      // Filter events within date range and convert to newsletter format
      const startDate = new Date(start);
      const endDate = new Date(end);
      
      const filteredEvents = events.filter(event => {
        try {
          // Parse various date formats from the events
          let eventDate: Date;
          
          if (event.date.includes(',')) {
            // Format like "Sat, July 19"
            const year = new Date().getFullYear(); // Use current year as default
            const datePart = event.date.replace(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s*/i, '');
            eventDate = new Date(`${datePart} ${year}`);
          } else {
            // Try parsing as is
            eventDate = new Date(event.date);
          }

          return eventDate >= startDate && eventDate <= endDate;
        } catch (parseError) {
          console.warn('Failed to parse event date:', event.date, parseError);
          return false;
        }
      });

      // Convert to newsletter event format
      return filteredEvents.map(event => ({
        id: `event-${event.id}`,
        originalEventId: event.id,
        title: event.name.replace(/^FALLBACK - /, ''), // Remove fallback prefix
        description: event.description.replace(/^FALLBACK - /, ''),
        time: event.time.replace(/^FALLBACK - /, ''),
        location: event.distance.replace(/^FALLBACK - /, ''), // Using distance as location for now
        date: formatDateForEvent(start), // Use formatted date
        isEditable: true,
      }));
    } catch (error) {
      console.error('Failed to fetch events:', error);
      return [];
    }
  };

  // Fallback events function
  const getFallbackEvents = (): Event[] => [
    {
      id: 1,
      name: "Summer Music Festival",
      date: "Sat, July 19",
      description: "Live bands, food trucks, and craft beer",
      time: "2:00 PM",
      price: "$15 per person",
      distance: "12 miles away",
      type: "festival",
      tags: ["music", "family-friendly", "outdoor"]
    },
    {
      id: 2,
      name: "Jazz Night at Blue Note",
      date: "Fri, July 18",
      description: "Local jazz quartet performing classics",
      time: "7:00 PM",
      price: "$20 cover",
      distance: "3 miles away",
      type: "music",
      tags: ["music", "nightlife", "indoor"]
    },
    {
      id: 3,
      name: "Hiking at Auburn State Park",
      date: "Sun, July 21",
      description: "Morning hike with scenic views",
      time: "8:00 AM",
      price: "$5 parking",
      distance: "25 miles away",
      type: "outdoor",
      tags: ["outdoor", "exercise", "family-friendly"]
    }
  ];

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a newsletter title');
      return;
    }

    if (generateEvents && (!startDate || !endDate)) {
      Alert.alert('Error', 'Please select both start and end dates for event generation');
      return;
    }

    if (generateEvents && new Date(startDate) > new Date(endDate)) {
      Alert.alert('Error', 'Start date must be before end date');
      return;
    }

    setIsCreating(true);

    try {
      // Create the newsletter
      const newsletter = await createNewsletter(title.trim());
      
      let events: NewsletterEvent[] = [];
      
      if (generateEvents && startDate && endDate) {
        // Generate events for the date range
        events = await getEventsForDateRange(startDate, endDate);
      }

      // Update newsletter with additional data
      const updatedNewsletter = {
        ...newsletter,
        startDate: generateEvents ? startDate : '',
        endDate: generateEvents ? endDate : '',
        events,
      };

      await updateNewsletter(newsletter.id, {
        startDate: updatedNewsletter.startDate,
        endDate: updatedNewsletter.endDate,
        events: updatedNewsletter.events,
      });

      // Reset form
      setTitle('');
      setGenerateEvents(false);
      setStartDate('');
      setEndDate('');
      
      onNewsletterCreated(updatedNewsletter);
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to create newsletter');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setTitle('');
    setGenerateEvents(false);
    setStartDate('');
    setEndDate('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Create Newsletter</Text>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={24} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Title Input */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Newsletter Title</Text>
            <TextInput
              style={styles.titleInput}
              value={title}
              onChangeText={setTitle}
              placeholder="Enter newsletter title..."
              placeholderTextColor="#6b7280"
              autoFocus
            />
          </View>

          {/* Event Generation Section */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setGenerateEvents(!generateEvents)}
            >
              <View style={[styles.checkbox, generateEvents && styles.checkboxChecked]}>
                {generateEvents && (
                  <Ionicons name="checkmark" size={16} color="#ffffff" />
                )}
              </View>
              <Text style={styles.checkboxLabel}>Auto-generate events for date range</Text>
            </TouchableOpacity>
            
            {generateEvents && (
              <View style={styles.dateRangeContainer}>
                <Text style={styles.dateRangeLabel}>Select Date Range for Events</Text>
                
                <View style={styles.dateInputContainer}>
                  <View style={styles.dateInputGroup}>
                    <Text style={styles.dateInputLabel}>Start Date</Text>
                    <TextInput
                      style={styles.dateInput}
                      value={startDate}
                      onChangeText={setStartDate}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#6b7280"
                    />
                    {startDate && (
                      <Text style={styles.datePreview}>{formatDateForDisplay(startDate)}</Text>
                    )}
                  </View>
                  
                  <View style={styles.dateInputGroup}>
                    <Text style={styles.dateInputLabel}>End Date</Text>
                    <TextInput
                      style={styles.dateInput}
                      value={endDate}
                      onChangeText={setEndDate}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#6b7280"
                    />
                    {endDate && (
                      <Text style={styles.datePreview}>{formatDateForDisplay(endDate)}</Text>
                    )}
                  </View>
                </View>

                <View style={styles.infoBox}>
                  <Ionicons name="information-circle-outline" size={20} color="#60a5fa" />
                  <Text style={styles.infoText}>
                    Events within this date range will be automatically added to your newsletter. 
                    You can edit each event individually after creation.
                  </Text>
                </View>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleClose}
            disabled={isCreating}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.createButton, isCreating && styles.createButtonDisabled]}
            onPress={handleCreate}
            disabled={isCreating}
          >
            <Text style={styles.createButtonText}>
              {isCreating ? 'Creating...' : 'Create & Edit'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  titleInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#60a5fa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#60a5fa',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#e5e7eb',
    flex: 1,
  },
  dateRangeContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  dateRangeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ffffff',
    marginBottom: 16,
  },
  dateInputContainer: {
    gap: 16,
    marginBottom: 16,
  },
  dateInputGroup: {
    gap: 8,
  },
  dateInputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#e5e7eb',
  },
  dateInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#4a4a4a',
  },
  datePreview: {
    fontSize: 12,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  infoBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#1a2332',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2563eb',
  },
  infoText: {
    fontSize: 14,
    color: '#93c5fd',
    flex: 1,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#3a3a3a',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9ca3af',
  },
  createButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
  createButtonDisabled: {
    backgroundColor: '#1e40af',
    opacity: 0.6,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});