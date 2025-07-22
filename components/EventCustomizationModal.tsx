import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Event } from '@/contexts/GroupsContext';

const { width } = Dimensions.get('window');

interface EventCustomizationModalProps {
  visible: boolean;
  onClose: () => void;
  event: Event;
  onSave: (customName: string, originalEvent: Event) => void;
}

export default function EventCustomizationModal({ 
  visible, 
  onClose, 
  event, 
  onSave 
}: EventCustomizationModalProps) {
  const [customName, setCustomName] = useState('');

  const handleSave = () => {
    onSave(customName.trim(), event);
    setCustomName('');
    onClose();
  };

  const handleCancel = () => {
    setCustomName('');
    onClose();
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

  const getEventTypeColor = (type: Event['type']) => {
    const colors = {
      festival: '#8b5cf6',
      music: '#06b6d4',
      outdoor: '#10b981',
      food: '#f59e0b',
    };
    return colors[type] || '#6b7280';
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={handleCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
            <View style={styles.headerCenter}>
              <Text style={styles.modalTitle}>Customize Event</Text>
              <Text style={styles.modalSubtitle}>Add this event to your group</Text>
            </View>
            <View style={styles.headerRight} />
          </View>
          
          <View style={styles.modalBody}>
            {/* Event Preview */}
            <View style={styles.eventPreview}>
              <View style={[styles.eventTypeIcon, { backgroundColor: getEventTypeColor(event.type) }]}>
                <Ionicons name={getEventTypeIcon(event.type)} size={16} color="#ffffff" />
              </View>
              <View style={styles.eventPreviewInfo}>
                <Text style={styles.customNameDisplay}>
                  {customName.trim() || event.name}
                </Text>
                {customName.trim() && (
                  <Text style={styles.originalNameDisplay}>{event.name}</Text>
                )}
                <Text style={styles.eventDetails}>{event.date} • {event.time}</Text>
              </View>
            </View>

            {/* Custom Name Input */}
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Custom Event Name (Optional)</Text>
              <TextInput
                style={styles.textInput}
                value={customName}
                onChangeText={setCustomName}
                placeholder={`Use "${event.name}" or enter custom name...`}
                placeholderTextColor="#6b7280"
                maxLength={50}
                autoCapitalize="words"
                autoCorrect={true}
                autoFocus={true}
              />
              <Text style={styles.inputHelper}>
                {customName.length}/50 characters
              </Text>
            </View>
          </View>
          
          <View style={styles.modalFooter}>
            <TouchableOpacity 
              style={styles.cancelButton} 
              onPress={handleCancel}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.saveButton} 
              onPress={handleSave}
            >
              <Text style={styles.saveButtonText}>Add to Group</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: '15%',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    width: width - 40,
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    maxHeight: '70%',
    minHeight: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  headerLeft: {
    width: 40,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerRight: {
    width: 40,
  },
  closeButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  modalBody: {
    padding: 20,
    flex: 1,
  },
  eventPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  eventTypeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  eventPreviewInfo: {
    flex: 1,
  },
  customNameDisplay: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  originalNameDisplay: {
    fontSize: 12,
    color: '#9ca3af',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  eventDetails: {
    fontSize: 14,
    color: '#9ca3af',
  },
  inputSection: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#e5e7eb',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#3a3a3a',
    marginBottom: 8,
  },
  inputHelper: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'right',
    marginBottom: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  cancelButtonText: {
    color: '#e5e7eb',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});