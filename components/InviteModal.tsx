import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Share,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';

interface InviteModalProps {
  visible: boolean;
  onClose: () => void;
  groupName: string;
  inviteLink: string;
}

export default function InviteModal({ visible, onClose, groupName, inviteLink }: InviteModalProps) {
  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join "${groupName}" on GroupEvent!\n\n${inviteLink}`,
        url: inviteLink, // iOS will use this for sharing
        title: `Join ${groupName}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
      Alert.alert('Error', 'Failed to share invite link');
    }
  };

  const handleCopyLink = async () => {
    try {
      await Clipboard.setStringAsync(inviteLink);
      Alert.alert('Copied!', 'Invite link copied to clipboard');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      Alert.alert('Error', 'Failed to copy link');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.modalContainer}>
          {/* Close Button Bar */}
          <TouchableOpacity style={styles.closeBar} onPress={onClose}>
            <Text style={styles.closeIcon}>×</Text>
          </TouchableOpacity>

          {/* Modal Content */}
          <View style={styles.content}>
            <Text style={styles.title}>Invite to {groupName}</Text>
            <Text style={styles.subtitle}>
              Share this link to invite others to join your group
            </Text>

            {/* Link Display */}
            <View style={styles.linkContainer}>
              <Text style={styles.linkText} numberOfLines={2}>
                {inviteLink}
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              {/* Share Button (iOS native sharing) */}
              <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                <Text style={styles.shareButtonText}>Share Invite</Text>
              </TouchableOpacity>

              {/* Copy Link Button */}
              <TouchableOpacity style={styles.copyButton} onPress={handleCopyLink}>
                <Text style={styles.copyButtonText}>Copy Link</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  closeBar: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  closeIcon: {
    fontSize: 28,
    color: '#9ca3af',
    fontWeight: '300',
  },
  content: {
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  linkContainer: {
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3a3a3a',
    padding: 16,
    marginBottom: 32,
  },
  linkText: {
    fontSize: 14,
    color: '#e5e7eb',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  buttonContainer: {
    gap: 16,
  },
  shareButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  copyButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3a3a3a',
    padding: 16,
    alignItems: 'center',
  },
  copyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e5e7eb',
  },
});