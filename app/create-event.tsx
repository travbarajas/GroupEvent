import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { ApiService } from '@/services/api';
import DateRangePicker from '@/components/DateRangePicker';

interface CreateEventForm {
  name: string;
  description: string;
  startDate: Date;
  endDate: Date | null; // null means single day event
  time: string; // Changed to string to allow any text input
  location: string;
}

export default function CreateEventScreen() {
  const insets = useSafeAreaInsets();
  const { groupId } = useLocalSearchParams();
  
  const [form, setForm] = useState<CreateEventForm>({
    name: '',
    description: '',
    startDate: new Date(),
    endDate: new Date(), // Initialize with today as end date too
    time: '',
    location: '',
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handleDateRangeChange = (startDate: Date, endDate: Date | null) => {
    setForm(prev => ({ 
      ...prev, 
      startDate: startDate,
      endDate: endDate
    }));
  };


  const formatDateRange = (startDate: Date, endDate: Date | null) => {
    if (!endDate) {
      return startDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
    
    const start = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const end = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${start} - ${end}`;
  };

  const selectImage = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to your photo library to select an image.');
        return;
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error selecting image:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
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
        startDate: form.startDate,
        endDate: form.endDate,
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
      <View style={[styles.headerContainer, { paddingTop: insets.top + 8 }]}>
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

          {/* Event Image */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Event Image</Text>
            {selectedImage ? (
              <View style={styles.imageContainer}>
                <Image source={{ uri: selectedImage }} style={styles.selectedImage} />
                <TouchableOpacity style={styles.removeImageButton} onPress={removeImage}>
                  <Ionicons name="close-circle" size={24} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.imagePickerButton} onPress={selectImage}>
                <Ionicons name="image-outline" size={32} color="#666" />
                <Text style={styles.imagePickerText}>Tap to add event image</Text>
                <Text style={styles.imagePickerSubtext}>Recommended: 16:9 aspect ratio</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Date Range */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Date *</Text>
            <DateRangePicker
              startDate={form.startDate}
              endDate={form.endDate}
              onDateChange={handleDateRangeChange}
            />
          </View>

          {/* Time */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Time</Text>
            <TextInput
              style={styles.textInput}
              value={form.time}
              onChangeText={(text) => setForm(prev => ({ ...prev, time: text }))}
              placeholder="e.g., 8:30 AM - 1:00 PM, All Day, Evening, etc."
              placeholderTextColor="#666"
              maxLength={100}
            />
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
  imageContainer: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  selectedImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
  },
  imagePickerButton: {
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#2a2a2a',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePickerText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
    marginTop: 8,
  },
  imagePickerSubtext: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
});