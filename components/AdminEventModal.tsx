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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ApiService } from '@/services/api';

interface AdminEventModalProps {
  visible: boolean;
  onClose: () => void;
  onEventCreated: () => void;
}

export default function AdminEventModal({ visible, onClose, onEventCreated }: AdminEventModalProps) {
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
        <View style={styles.header}>
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

            {/* Date and Time */}
            <View style={styles.row}>
              <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>Date</Text>
                <TextInput
                  style={styles.input}
                  value={formData.date}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, date: text }))}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#6b7280"
                />
              </View>
              <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>Time</Text>
                <TextInput
                  style={styles.input}
                  value={formData.time}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, time: text }))}
                  placeholder="HH:MM"
                  placeholderTextColor="#6b7280"
                />
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
});