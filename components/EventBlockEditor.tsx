import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NewsletterEvent } from '@/types/newsletter';

interface EventBlockEditorProps {
  event: NewsletterEvent;
  visible: boolean;
  onClose: () => void;
  onSave: (updatedEvent: NewsletterEvent) => void;
  onDelete: () => void;
}

export default function EventBlockEditor({
  event,
  visible,
  onClose,
  onSave,
  onDelete,
}: EventBlockEditorProps) {
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description);
  const [time, setTime] = useState(event.time);
  const [location, setLocation] = useState(event.location);
  const [date, setDate] = useState(event.date);

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Event title is required');
      return;
    }

    const updatedEvent: NewsletterEvent = {
      ...event,
      title: title.trim(),
      description: description.trim(),
      time: time.trim(),
      location: location.trim(),
      date: date.trim(),
    };

    onSave(updatedEvent);
    onClose();
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Event',
      'Are you sure you want to remove this event from the newsletter?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            onDelete();
            onClose();
          }
        },
      ]
    );
  };

  const handleClose = () => {
    // Reset to original values
    setTitle(event.title);
    setDescription(event.description);
    setTime(event.time);
    setLocation(event.location);
    setDate(event.date);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={handleClose}>
            <Ionicons name="close" size={24} color="#9ca3af" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Event</Text>
          <TouchableOpacity style={styles.headerButton} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={24} color="#ef4444" />
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Day & Date</Text>
            <TextInput
              style={styles.input}
              value={date}
              onChangeText={setDate}
              placeholder="e.g. Thursday – 8/14"
              placeholderTextColor="#6b7280"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Event Title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Enter event title..."
              placeholderTextColor="#6b7280"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Enter event description..."
              placeholderTextColor="#6b7280"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Time</Text>
            <TextInput
              style={styles.input}
              value={time}
              onChangeText={setTime}
              placeholder="e.g. 5:00 PM – 10:00 PM"
              placeholderTextColor="#6b7280"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Location</Text>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="e.g. Vernon Street Town Square, 311 Vernon St"
              placeholderTextColor="#6b7280"
            />
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Save Changes</Text>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  headerButton: {
    padding: 8,
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
  },
  form: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ffffff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
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
    borderRadius: 8,
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#3a3a3a',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#9ca3af',
  },
  saveButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
  },
});