import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Dimensions,
  Image,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface ProfileSetupModalProps {
  visible: boolean;
  onComplete: (username: string, profilePicture: string) => void;
  onSkip: () => void;
}

const defaultAvatars = [
  '😀', '😎', '🤠', '🥸', '🤩', '🥳', '😇', '🤓',
  '🙂', '😊', '😁', '😆', '😂', '🤣', '😋', '😛',
  '🤔', '🙄', '😴', '🤯', '🥶', '🥵', '😱', '🤗',
  '🦸', '🦹', '🧙', '🧚', '🧛', '🧜', '🧞', '🧝',
];

export default function ProfileSetupModal({ visible, onComplete, onSkip }: ProfileSetupModalProps) {
  const [username, setUsername] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(defaultAvatars[0]);

  const handleComplete = () => {
    if (username.trim()) {
      onComplete(username.trim(), selectedAvatar);
      setUsername('');
      setSelectedAvatar(defaultAvatars[0]);
    }
  };

  const handleSkip = () => {
    onSkip();
    setUsername('');
    setSelectedAvatar(defaultAvatars[0]);
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={handleSkip}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Set Up Your Profile</Text>
            <Text style={styles.modalSubtitle}>
              Choose a username and avatar to get started
            </Text>
          </View>
          
          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Avatar Selection */}
            <View style={styles.avatarSection}>
              <Text style={styles.sectionLabel}>Choose Avatar</Text>
              <View style={styles.selectedAvatarContainer}>
                <Text style={styles.selectedAvatar}>{selectedAvatar}</Text>
              </View>
              
              <View style={styles.avatarGrid}>
                {defaultAvatars.map((avatar, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.avatarOption,
                      selectedAvatar === avatar && styles.avatarOptionSelected
                    ]}
                    onPress={() => setSelectedAvatar(avatar)}
                  >
                    <Text style={styles.avatarText}>{avatar}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Username Input */}
            <View style={styles.usernameSection}>
              <Text style={styles.sectionLabel}>Username</Text>
              <TextInput
                style={styles.textInput}
                value={username}
                onChangeText={setUsername}
                placeholder="Enter your username..."
                placeholderTextColor="#6b7280"
                maxLength={20}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.inputHelper}>
                {username.length}/20 characters
              </Text>
            </View>
          </ScrollView>
          
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
              ]}>Complete Setup</Text>
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
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
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
    flex: 1,
    padding: 20,
  },
  avatarSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  selectedAvatarContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  selectedAvatar: {
    fontSize: 60,
    backgroundColor: '#2a2a2a',
    borderRadius: 40,
    width: 80,
    height: 80,
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 80,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  avatarOption: {
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarOptionSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#1e40af',
  },
  avatarText: {
    fontSize: 20,
  },
  usernameSection: {
    marginBottom: 24,
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