import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ApiService } from '@/services/api';

interface CreateEventForm {
  name: string;
  description: string;
  date: Date;
  time: Date | null;
  location: string;
}

export default function CreateEventScreen() {
  const insets = useSafeAreaInsets();
  const { groupId } = useLocalSearchParams();
  
  const [form, setForm] = useState<CreateEventForm>({
    name: '',
    description: '',
    date: new Date(),
    time: null,
    location: '',
  });
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (selectedDate) {
      setForm(prev => ({ ...prev, date: selectedDate }));
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    if (selectedTime) {
      setForm(prev => ({ ...prev, time: selectedTime }));
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (time: Date) => {
    return time.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      Alert.alert('Error', 'Please enter an event name');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Create the custom event using the API
      await ApiService.createCustomEvent(groupId as string, {
        name: form.name,
        description: form.description,
        date: form.date,
        time: form.time,
        location: form.location
      });
      
      Alert.alert(
        'Event Created!',
        'Your custom event has been added to the group.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
      
    } catch (error) {
      console.error('Error creating event:', error);
      Alert.alert('Error', 'Failed to create event. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
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
          <Text style={styles.headerTitle}>Create Event</Text>
          <View style={styles.headerSpacer} />
        </View>
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.formContainer}>
          {/* Event Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Event Name *</Text>
            <TextInput
              style={styles.textInput}
              value={form.name}
              onChangeText={(text) => setForm(prev => ({ ...prev, name: text }))}
              placeholder="e.g., Hanging at my house"
              placeholderTextColor="#666"
              maxLength={100}
            />
          </View>

          {/* Description */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={form.description}
              onChangeText={(text) => setForm(prev => ({ ...prev, description: text }))}
              placeholder="What's happening? (optional)"
              placeholderTextColor="#666"
              multiline
              numberOfLines={3}
              maxLength={500}
            />
          </View>

          {/* Date */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Date *</Text>
            <TouchableOpacity 
              style={styles.dateTimeButton}
              onPress={() => setShowDatePicker(!showDatePicker)}
            >
              <Ionicons name="calendar" size={20} color="#60a5fa" />
              <Text style={styles.dateTimeText}>
                {formatDate(form.date)}
              </Text>
              <Ionicons name={showDatePicker ? "chevron-up" : "chevron-down"} size={16} color="#666" />
            </TouchableOpacity>
            {showDatePicker && (
              <View style={styles.inlinePicker}>
                <DateTimePicker
                  value={form.date}
                  mode="date"
                  display="spinner"
                  onChange={handleDateChange}
                  minimumDate={new Date()}
                  textColor="#ffffff"
                />
              </View>
            )}
          </View>

          {/* Time */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Time</Text>
            <TouchableOpacity 
              style={styles.dateTimeButton}
              onPress={() => setShowTimePicker(!showTimePicker)}
            >
              <Ionicons name="time" size={20} color="#60a5fa" />
              <Text style={styles.dateTimeText}>
                {form.time ? formatTime(form.time) : 'No time set (all day)'}
              </Text>
              <Ionicons name={showTimePicker ? "chevron-up" : "chevron-down"} size={16} color="#666" />
            </TouchableOpacity>
            {showTimePicker && (
              <View style={styles.inlinePicker}>
                <DateTimePicker
                  value={form.time || new Date()}
                  mode="time"
                  display="spinner"
                  onChange={handleTimeChange}
                  textColor="#ffffff"
                />
              </View>
            )}
            {form.time && (
              <TouchableOpacity 
                style={styles.clearTimeButton}
                onPress={() => setForm(prev => ({ ...prev, time: null }))}
              >
                <Text style={styles.clearTimeText}>Clear time (make all-day)</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Location */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.textInput}
              value={form.location}
              onChangeText={(text) => setForm(prev => ({ ...prev, location: text }))}
              placeholder="Where is it happening? (optional)"
              placeholderTextColor="#666"
              maxLength={200}
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity 
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <Text style={styles.submitButtonText}>
              {isSubmitting ? 'Creating Event...' : 'Create Event'}
            </Text>
          </TouchableOpacity>
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
  formContainer: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#ffffff',
    minHeight: 50,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  dateTimeButton: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50,
  },
  dateTimeText: {
    fontSize: 16,
    color: '#ffffff',
    flex: 1,
    marginLeft: 12,
  },
  clearTimeButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  clearTimeText: {
    fontSize: 14,
    color: '#60a5fa',
    textDecorationLine: 'underline',
  },
  submitButton: {
    backgroundColor: '#60a5fa',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  submitButtonDisabled: {
    backgroundColor: '#2a2a2a',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  inlinePicker: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    marginTop: 8,
    paddingVertical: 8,
  },
});