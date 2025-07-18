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

const { width } = Dimensions.get('window');

interface UsernameModalProps {
  visible: boolean;
  onComplete: (username: string) => void;
  onSkip: () => void;
}

export default function UsernameModal({ visible, onComplete, onSkip }: UsernameModalProps) {
  const [username, setUsername] = useState('');

  const handleComplete = () => {
    if (username.trim()) {
      onComplete(username.trim());
      setUsername('');
    }
  };

  const handleSkip = () => {
    onSkip();
    setUsername('');
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={handleSkip}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Set Your Username</Text>
            <Text style={styles.modalSubtitle}>
              Choose a name to display in groups
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
          </View>
          
          <View style={styles.modalButtons}>
            <TouchableOpacity 
              style={styles.skipButton} 
              onPress={handleSkip}
            >
              <Text style={styles.skipButtonText}>Skip for now</Text>
            </TouchableOpacity>
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
              ]}>Save Username</Text>
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
    fontSize: 18,
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
  },
  modalButtons: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  skipButton: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  skipButtonText: {
    color: '#e5e7eb',
    fontSize: 16,
    fontWeight: '600',
  },
  completeButton: {
    flex: 1,
    backgroundColor: '#2563eb',
    paddingVertical: 12,
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