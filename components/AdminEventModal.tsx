import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { ApiService } from '@/services/api';

interface AdminEventModalProps {
  visible: boolean;
  onClose: () => void;
  onEventCreated: () => void;
}

export default function AdminEventModal({ visible, onClose, onEventCreated }: AdminEventModalProps) {
  const insets = useSafeAreaInsets();
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    date: '',
    time: '',
    location: '',
    venue_name: '',
    price: '',
    currency: 'USD',
    is_free: false,
    category: 'music',
    tags: [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());
  const [tempTime, setTempTime] = useState(new Date());
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const categories = [
    { value: 'music', label: 'Music' },
    { value: 'festival', label: 'Festival' },
    { value: 'outdoor', label: 'Outdoor' },
    { value: 'food', label: 'Food & Drink' },
    { value: 'sports', label: 'Sports' },
    { value: 'arts', label: 'Arts & Culture' },
    { value: 'nightlife', label: 'Nightlife' },
    { value: 'community', label: 'Community' },
  ];

  const availableTags = [
    'free', 'family-friendly', 'music', 'outdoor', 'indoor', 'nightlife', 
    'food', 'exercise', 'arts', 'educational', 'social', 'entertainment'
  ];

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setTempDate(selectedDate);
      if (Platform.OS === 'android' || event.type === 'set') {
        const formattedDate = selectedDate.toISOString().split('T')[0]; // YYYY-MM-DD
        setFormData(prev => ({ ...prev, date: formattedDate }));
      }
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    if (selectedTime) {
      setTempTime(selectedTime);
      if (Platform.OS === 'android' || event.type === 'set') {
        const hours = selectedTime.getHours().toString().padStart(2, '0');
        const minutes = selectedTime.getMinutes().toString().padStart(2, '0');
        const formattedTime = `${hours}:${minutes}`;
        setFormData(prev => ({ ...prev, time: formattedTime }));
      }
    }
  };

  const selectImage = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to your photo library to select an image.');
        return;
      }

      console.log('Opening image picker...');
      
      // Pick image - using the working deprecated API for now
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      console.log('Image picker result:', result);

      if (!result.canceled && result.assets && result.assets[0]) {
        console.log('Selected image URI:', result.assets[0].uri);
        setSelectedImage(result.assets[0].uri);
      } else {
        console.log('Image selection was canceled or failed');
      }
    } catch (error) {
      console.error('Error selecting image:', error);
      Alert.alert('Error', `Failed to select image: ${error.message}`);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      date: '',
      time: '',
      location: '',
      venue_name: '',
      price: '',
      currency: 'USD',
      is_free: false,
      category: 'music',
      tags: [],
    });
    setTempDate(new Date());
    setTempTime(new Date());
    setSelectedImage(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Event name is required');
      return;
    }

    // Validate date format if provided
    const dateValue = formData.date.trim();
    if (dateValue && !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      Alert.alert('Error', 'Date must be in YYYY-MM-DD format (e.g., 2024-07-23)');
      return;
    }

    // Validate time format if provided
    const timeValue = formData.time.trim();
    if (timeValue && !/^\d{2}:\d{2}$/.test(timeValue)) {
      Alert.alert('Error', 'Time must be in HH:MM format (e.g., 14:30)');
      return;
    }

    setIsSubmitting(true);
    try {
      let imageUrl = null;
      
      // Upload image if selected
      if (selectedImage) {
        try {
          // Create form data for image upload
          const formData = new FormData();
          formData.append('image', {
            uri: selectedImage,
            type: 'image/jpeg',
            name: 'event-image.jpg',
          } as any);
          
          // Upload to your image storage service
          const imageResponse = await fetch('/api/upload-image', {
            method: 'POST',
            body: formData,
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });
          
          if (imageResponse.ok) {
            const imageResult = await imageResponse.json();
            imageUrl = imageResult.url;
          } else {
            console.warn('Image upload failed, proceeding without image');
          }
        } catch (imageError) {
          console.warn('Image upload error:', imageError);
          // Continue without image rather than failing the entire event creation
        }
      }

      const eventData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        date: dateValue || null,
        time: timeValue || null,
        location: formData.location.trim() || null,
        venue_name: formData.venue_name.trim() || null,
        price: formData.is_free ? 0 : parseFloat(formData.price) || 0,
        currency: formData.currency.trim() || 'USD',
        is_free: formData.is_free,
        category: formData.category || null,
        tags: formData.tags,
        max_attendees: null,
        min_attendees: null,
        attendance_required: false,
        image_url: imageUrl, // Include the uploaded image URL
      };

      console.log('Creating event with data:', eventData);
      await ApiService.createGlobalEvent(eventData);
      
      Alert.alert('Success', 'Event created successfully!', [
        {
          text: 'OK',
          onPress: () => {
            handleClose();
            onEventCreated();
          }
        }
      ]);
    } catch (error) {
      console.error('Failed to create event:', error);
      Alert.alert('Error', 'Failed to create event. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create New Event</Text>
          <TouchableOpacity 
            onPress={handleSubmit}
            style={[styles.saveButton, isSubmitting && styles.saveButtonDisabled]}
            disabled={isSubmitting}
          >
            <Text style={styles.saveButtonText}>
              {isSubmitting ? 'Creating...' : 'Create'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.form}>
            {/* Event Name */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Event Name *</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                placeholder="Enter event name"
                placeholderTextColor="#6b7280"
              />
            </View>

            {/* Description */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.description}
                onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                placeholder="Enter event description"
                placeholderTextColor="#6b7280"
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Event Image */}
            <View style={styles.formGroup}>
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
                  <Ionicons name="image-outline" size={32} color="#6b7280" />
                  <Text style={styles.imagePickerText}>Tap to add event image</Text>
                  <Text style={styles.imagePickerSubtext}>Recommended: 16:9 aspect ratio</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Date and Time */}
            <View style={styles.row}>
              <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>Date</Text>
                <TouchableOpacity
                  style={styles.dateTimeButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Ionicons name="calendar-outline" size={20} color="#6b7280" />
                  <Text style={styles.dateTimeText}>
                    {formData.date || 'Select Date'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>Time</Text>
                <TouchableOpacity
                  style={styles.dateTimeButton}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Ionicons name="time-outline" size={20} color="#6b7280" />
                  <Text style={styles.dateTimeText}>
                    {formData.time || 'Select Time'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Location */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Location</Text>
              <TextInput
                style={styles.input}
                value={formData.location}
                onChangeText={(text) => setFormData(prev => ({ ...prev, location: text }))}
                placeholder="Enter location"
                placeholderTextColor="#6b7280"
              />
            </View>

            {/* Venue Name */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Venue Name</Text>
              <TextInput
                style={styles.input}
                value={formData.venue_name}
                onChangeText={(text) => setFormData(prev => ({ ...prev, venue_name: text }))}
                placeholder="Enter venue name"
                placeholderTextColor="#6b7280"
              />
            </View>

            {/* Category */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryContainer}>
                {categories.map((category) => (
                  <TouchableOpacity
                    key={category.value}
                    style={[
                      styles.categoryChip,
                      formData.category === category.value && styles.categoryChipSelected
                    ]}
                    onPress={() => setFormData(prev => ({ ...prev, category: category.value }))}
                  >
                    <Text style={[
                      styles.categoryChipText,
                      formData.category === category.value && styles.categoryChipTextSelected
                    ]}>
                      {category.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Pricing */}
            <View style={styles.formGroup}>
              <View style={styles.switchRow}>
                <Text style={styles.label}>Free Event</Text>
                <Switch
                  value={formData.is_free}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, is_free: value }))}
                  trackColor={{ false: '#374151', true: '#10b981' }}
                  thumbColor={formData.is_free ? '#ffffff' : '#9ca3af'}
                />
              </View>
            </View>

            {/* Tags */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Tags</Text>
              <View style={styles.tagSelectionContainer}>
                {availableTags.map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    style={[
                      styles.tagSelectionChip,
                      formData.tags.includes(tag) && styles.tagSelectionChipSelected
                    ]}
                    onPress={() => {
                      setFormData(prev => ({
                        ...prev,
                        tags: prev.tags.includes(tag)
                          ? prev.tags.filter(t => t !== tag)
                          : [...prev.tags, tag]
                      }));
                    }}
                  >
                    <Text style={[
                      styles.tagSelectionChipText,
                      formData.tags.includes(tag) && styles.tagSelectionChipTextSelected
                    ]}>
                      {tag}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {!formData.is_free && (
              <View style={styles.row}>
                <View style={[styles.formGroup, { flex: 2, marginRight: 8 }]}>
                  <Text style={styles.label}>Price</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.price}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, price: text }))}
                    placeholder="0.00"
                    placeholderTextColor="#6b7280"
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.label}>Currency</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.currency}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, currency: text.toUpperCase() }))}
                    placeholder="USD"
                    placeholderTextColor="#6b7280"
                    maxLength={3}
                  />
                </View>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Date Picker */}
        {showDatePicker && (
          <DateTimePicker
            value={tempDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
            style={Platform.OS === 'ios' ? styles.iosPicker : undefined}
          />
        )}

        {/* Time Picker */}
        {showTimePicker && (
          <DateTimePicker
            value={tempTime}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleTimeChange}
            style={Platform.OS === 'ios' ? styles.iosPicker : undefined}
          />
        )}

        {/* iOS Picker Overlay */}
        {(showDatePicker || showTimePicker) && Platform.OS === 'ios' && (
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerContainer}>
              <View style={styles.pickerHeader}>
                <TouchableOpacity onPress={() => {
                  setShowDatePicker(false);
                  setShowTimePicker(false);
                }}>
                  <Text style={styles.pickerButton}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {
                  if (showDatePicker) {
                    const formattedDate = tempDate.toISOString().split('T')[0];
                    setFormData(prev => ({ ...prev, date: formattedDate }));
                    setShowDatePicker(false);
                  }
                  if (showTimePicker) {
                    const hours = tempTime.getHours().toString().padStart(2, '0');
                    const minutes = tempTime.getMinutes().toString().padStart(2, '0');
                    const formattedTime = `${hours}:${minutes}`;
                    setFormData(prev => ({ ...prev, time: formattedTime }));
                    setShowTimePicker(false);
                  }
                }}>
                  <Text style={[styles.pickerButton, styles.pickerButtonDone]}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    backgroundColor: '#1a1a1a',
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  saveButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  saveButtonDisabled: {
    backgroundColor: '#374151',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollContainer: {
    flex: 1,
  },
  form: {
    padding: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#ffffff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryContainer: {
    flexDirection: 'row',
  },
  categoryChip: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  categoryChipSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  categoryChipText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  categoryChipTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
  tagSelectionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagSelectionChip: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 8,
  },
  tagSelectionChipSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  tagSelectionChipText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  tagSelectionChipTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
  dateTimeButton: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateTimeText: {
    fontSize: 16,
    color: '#ffffff',
    marginLeft: 8,
    flex: 1,
  },
  iosPicker: {
    backgroundColor: '#1a1a1a',
  },
  pickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    backgroundColor: '#1a1a1a',
    paddingBottom: 30,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  pickerButton: {
    fontSize: 16,
    color: '#6b7280',
  },
  pickerButtonDone: {
    color: '#2563eb',
    fontWeight: '600',
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
    color: '#6b7280',
    fontWeight: '500',
    marginTop: 8,
  },
  imagePickerSubtext: {
    fontSize: 14,
    color: '#4b5563',
    marginTop: 4,
  },
});