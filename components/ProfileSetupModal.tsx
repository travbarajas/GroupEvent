import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');

interface ProfileSetupModalProps {
  visible: boolean;
  onComplete: (username: string, profilePicture: string, color?: string) => void;
  groupName?: string;
  initialUsername?: string;
  initialColor?: string;
}

const PRESET_COLORS = [
  '#60a5fa', // Blue
  '#34d399', // Green
  '#f87171', // Red
  '#fbbf24', // Yellow
  '#a78bfa', // Purple
  '#fb7185', // Pink
  '#fb923c', // Orange
  '#22d3ee', // Cyan
  '#c084fc', // Violet
  '#4ade80', // Lime
];

export default function ProfileSetupModal({ 
  visible, 
  onComplete, 
  groupName, 
  initialUsername = '', 
  initialColor = PRESET_COLORS[0] 
}: ProfileSetupModalProps) {
  const [username, setUsername] = useState(initialUsername);
  const [selectedColor, setSelectedColor] = useState(initialColor);

  // Update state when props change
  useEffect(() => {
    setUsername(initialUsername);
    setSelectedColor(initialColor);
  }, [initialUsername, initialColor]);

  const handleComplete = () => {
    if (username.trim()) {
      onComplete(username.trim(), '', selectedColor); // Include selected color
      setUsername('');
      setSelectedColor(PRESET_COLORS[0]); // Reset to default
    }
  };


  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={() => {}}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Set Your Profile</Text>
            <Text style={styles.modalSubtitle}>
              {initialUsername ? 
                (groupName ? `Update your profile for "${groupName}"` : 'Update your profile for this group') :
                (groupName ? `Choose a username and color for "${groupName}"` : 'Choose a username and color for this group')
              }
            </Text>
          </View>
          
          <View style={styles.modalBody}>
            <Text style={styles.inputLabel}>Username</Text>
            <TextInput
              style={styles.textInput}
              value={username}
              onChangeText={setUsername}
              placeholder="Enter your username..."
              placeholderTextColor="#6b7280"
              maxLength={20}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus={true}
            />
            <Text style={styles.inputHelper}>
              {username.length}/20 characters
            </Text>
            
            <Text style={styles.inputLabel}>Your Color</Text>
            <View style={styles.colorPicker}>
              {PRESET_COLORS.map((color, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    selectedColor === color && styles.colorOptionSelected
                  ]}
                  onPress={() => setSelectedColor(color)}
                >
                  {selectedColor === color && (
                    <Text style={styles.colorSelectedText}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.colorHelper}>
              This color will be used for events you create
            </Text>
          </View>
          
          <View style={styles.modalButtons}>
            <TouchableOpacity 
              style={[
                styles.completeButton, 
                !username.trim() && styles.completeButtonDisabled
              ]} 
              onPress={handleComplete}
              disabled={!username.trim()}
            >
              <Text style={[
                styles.completeButtonText,
                !username.trim() && styles.completeButtonTextDisabled
              ]}>Save Profile</Text>
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
    paddingTop: '20%',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    width: width - 40,
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  modalHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  modalBody: {
    padding: 20,
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
    marginBottom: 20,
  },
  colorPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: '#ffffff',
    borderWidth: 3,
  },
  colorSelectedText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  colorHelper: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  modalButtons: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  completeButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  completeButtonDisabled: {
    backgroundColor: '#2a2a2a',
  },
  completeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  completeButtonTextDisabled: {
    color: '#6b7280',
  },
});