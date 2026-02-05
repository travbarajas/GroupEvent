import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ApiService } from '@/services/api';
import { Event } from '@/contexts/GroupsContext';
import DateRangePicker from '@/components/DateRangePicker';

function parseEventDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

export default function EditEventScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const event: Event | null = params.event ? JSON.parse(params.event as string) : null;

  const [formData, setFormData] = useState({
    name: event?.name || '',
    description: event?.description || '',
    startDate: parseEventDate(event?.date || ''),
    endDate: parseEventDate(event?.date || '') as Date | null,
    time: event?.time || '',
    location: event?.location || '',
    venue_name: event?.venue_name || '',
    price: event?.price || '',
    currency: 'USD',
    is_free: event?.is_free || false,
    category: event?.category || 'music',
    tags: (event?.tags || []) as string[],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(event?.image_url || null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Refs for input navigation
  const nameRef = useRef<TextInput>(null);
  const descriptionRef = useRef<TextInput>(null);
  const timeRef = useRef<TextInput>(null);
  const locationRef = useRef<TextInput>(null);
  const venueRef = useRef<TextInput>(null);
  const priceRef = useRef<TextInput>(null);

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

  if (!event) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Event Not Found</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Event details not available</Text>
        </View>
      </View>
    );
  }

  const handleDateRangeChange = (startDate: Date, endDate: Date | null) => {
    setFormData(prev => ({
      ...prev,
      startDate: startDate,
      endDate: endDate
    }));
  };

  const selectImage = async () => {
    if (Platform.OS === 'web') {
      // Web: use native file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (event: any) => {
        const file = event.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            setSelectedImage(dataUrl);
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    } else {
      // Native: use expo-image-picker
      try {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Please allow access to your photo library to select an image.');
          return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaType.Images,
          allowsEditing: true,
          aspect: [16, 9],
          quality: 0.8,
        });

        if (!result.canceled && result.assets && result.assets[0]) {
          setSelectedImage(result.assets[0].uri);
        }
      } catch (error) {
        console.error('Error selecting image:', error);
        Alert.alert('Error', `Failed to select image: ${(error as Error).message}`);
      }
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
  };

  const formatDateForApi = (date: Date): string => {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  };

  const formatDateRange = (): string => {
    if (!formData.endDate || formData.startDate.getTime() === formData.endDate.getTime()) {
      return formatDateForApi(formData.startDate);
    }
    return `${formatDateForApi(formData.startDate)} to ${formatDateForApi(formData.endDate)}`;
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Event name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      let imageUrl = selectedImage;

      const updateData = {
        id: event.id,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        date: formatDateRange(),
        time: formData.time.trim() || null,
        location: formData.location.trim() || null,
        venue_name: formData.venue_name.trim() || null,
        price: formData.is_free ? 0 : parseFloat(formData.price) || 0,
        currency: formData.currency.trim() || 'USD',
        is_free: formData.is_free,
        category: formData.category || null,
        tags: formData.tags,
        image_url: imageUrl,
      };

      await ApiService.updateGlobalEvent(updateData);

      // Show success message
      setShowSuccess(true);

      // Close after a brief delay to show success
      setTimeout(() => {
        setShowSuccess(false);
        router.back();
      }, 1000);

    } catch (error) {
      console.error('Error updating event:', error);
      Alert.alert('Error', 'Failed to update event. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Event</Text>
        <TouchableOpacity
          onPress={handleSubmit}
          style={[styles.saveButton, isSubmitting && styles.saveButtonDisabled]}
          disabled={isSubmitting}
        >
          <Text style={styles.saveButtonText}>
            {isSubmitting ? '...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Success Banner */}
      {showSuccess && (
        <View style={styles.successBanner}>
          <Ionicons name="checkmark-circle" size={24} color="#ffffff" />
          <Text style={styles.successText}>
            Event "{formData.name}" updated successfully!
          </Text>
        </View>
      )}

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.form}>
          {/* Event Name */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Event Name *</Text>
            <TextInput
              ref={nameRef}
              style={styles.input}
              value={formData.name}
              onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
              placeholder="Enter event name"
              placeholderTextColor="#6b7280"
              returnKeyType="next"
              onSubmitEditing={() => descriptionRef.current?.focus()}
              blurOnSubmit={false}
            />
          </View>

          {/* Description */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              ref={descriptionRef}
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
              placeholder="Enter event description"
              placeholderTextColor="#6b7280"
              multiline
              numberOfLines={3}
              returnKeyType="next"
              blurOnSubmit={true}
              onSubmitEditing={() => timeRef.current?.focus()}
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

          {/* Date */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Date</Text>
            <DateRangePicker
              startDate={formData.startDate}
              endDate={formData.endDate}
              onDateChange={handleDateRangeChange}
            />
          </View>

          {/* Time */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Time</Text>
            <TextInput
              ref={timeRef}
              style={styles.input}
              value={formData.time}
              onChangeText={(text) => setFormData(prev => ({ ...prev, time: text }))}
              placeholder="e.g., 8:30 AM - 1:00 PM, All Day, Evening, etc."
              placeholderTextColor="#6b7280"
              returnKeyType="next"
              onSubmitEditing={() => locationRef.current?.focus()}
              blurOnSubmit={false}
            />
          </View>

          {/* Location */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Location</Text>
            <TextInput
              ref={locationRef}
              style={styles.input}
              value={formData.location}
              onChangeText={(text) => setFormData(prev => ({ ...prev, location: text }))}
              placeholder="Enter location"
              placeholderTextColor="#6b7280"
              returnKeyType="next"
              onSubmitEditing={() => venueRef.current?.focus()}
              blurOnSubmit={false}
            />
          </View>

          {/* Venue Name */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Venue Name</Text>
            <TextInput
              ref={venueRef}
              style={styles.input}
              value={formData.venue_name}
              onChangeText={(text) => setFormData(prev => ({ ...prev, venue_name: text }))}
              placeholder="Enter venue name"
              placeholderTextColor="#6b7280"
              returnKeyType="done"
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
                  ref={priceRef}
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
    </View>
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
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  successText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
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
