import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface Member {
  member_id: string;
  device_id: string;
  role: string;
  username?: string;
  profile_picture?: string;
  has_username: boolean;
  color?: string;
}

interface GroupMembersModalProps {
  visible: boolean;
  onClose: () => void;
  members: Member[];
  groupName: string;
  onLeaveGroup: () => void;
  currentUserRole?: string;
  currentUserDeviceId?: string;
  onEditUsername?: () => void;
}

export default function GroupMembersModal({ 
  visible, 
  onClose, 
  members, 
  groupName, 
  onLeaveGroup,
  currentUserRole,
  currentUserDeviceId,
  onEditUsername
}: GroupMembersModalProps) {
  const [showLeaveConfirmation, setShowLeaveConfirmation] = useState(false);
  
  const handleLeavePress = () => {
    setShowLeaveConfirmation(true);
  };

  const handleConfirmLeave = () => {
    setShowLeaveConfirmation(false);
    onLeaveGroup();
  };

  const handleCancelLeave = () => {
    setShowLeaveConfirmation(false);
  };
  
  const MemberItem = ({ member }: { member: Member }) => {
    const isCurrentUser = member.device_id === currentUserDeviceId;
    
    return (
      <View style={styles.memberItem}>
        <View style={styles.memberAvatar}>
          {member.profile_picture ? (
            <Text style={styles.avatarEmoji}>{member.profile_picture}</Text>
          ) : (
            <Ionicons name="person" size={20} color="#9ca3af" />
          )}
        </View>
        
        <View style={styles.memberInfo}>
          <View style={styles.memberNameRow}>
            <View style={styles.memberNameWithColor}>
              <Text style={styles.memberName}>
                {member.username || `User ${member.device_id.substring(0, 8)}...`}
                {isCurrentUser && <Text style={styles.youLabel}> (You)</Text>}
              </Text>
              {member.color && (
                <View 
                  style={[
                    styles.colorIndicator, 
                    { backgroundColor: member.color }
                  ]} 
                />
              )}
            </View>
            {isCurrentUser && onEditUsername && (
              <TouchableOpacity 
                style={styles.editButton} 
                onPress={onEditUsername}
              >
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>
          {!member.has_username && (
            <Text style={styles.memberStatus}>Username not set</Text>
          )}
        </View>
        
        <View style={styles.memberRole}>
          {member.role === 'creator' && (
            <View style={styles.creatorBadge}>
              <Text style={styles.creatorText}>Creator</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.modalOverlay} 
        activeOpacity={1} 
        onPress={onClose}
      >
        <TouchableOpacity 
          style={styles.modalContent} 
          activeOpacity={1} 
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
            <View style={styles.headerCenter}>
              <Text style={styles.modalTitle}>Members</Text>
              <Text style={styles.modalSubtitle}>{groupName}</Text>
            </View>
            <View style={styles.headerRight} />
          </View>
          
          <ScrollView style={styles.membersList} showsVerticalScrollIndicator={false}>
            {members.map((member) => (
              <MemberItem key={member.member_id} member={member} />
            ))}
            
            {members.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No members found</Text>
              </View>
            )}
          </ScrollView>
          
          <View style={styles.modalFooter}>
            <TouchableOpacity 
              style={styles.leaveButton} 
              onPress={handleLeavePress}
            >
              <Ionicons name="exit-outline" size={20} color="#ffffff" />
              <Text style={styles.leaveButtonText}>Leave Group</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Leave Confirmation Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showLeaveConfirmation}
        onRequestClose={handleCancelLeave}
      >
        <View style={styles.confirmationOverlay}>
          <View style={styles.confirmationContent}>
            <View style={styles.confirmationHeader}>
              <Ionicons name="warning" size={24} color="#ef4444" />
              <Text style={styles.confirmationTitle}>Leave Group</Text>
            </View>
            
            <View style={styles.confirmationBody}>
              <Text style={styles.confirmationText}>
                Are you sure you want to leave "{groupName}"?
              </Text>
              <Text style={styles.confirmationSubtext}>
                This action cannot be undone.
              </Text>
            </View>
            
            <View style={styles.confirmationButtons}>
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={handleCancelLeave}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.confirmLeaveButton} 
                onPress={handleConfirmLeave}
              >
                <Text style={styles.confirmLeaveButtonText}>Leave Group</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
    minHeight: '50%',
    borderWidth: 1,
    borderColor: '#2a2a2a',
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
  },
  membersList: {
    flex: 1,
    padding: 20,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    minHeight: 56,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarEmoji: {
    fontSize: 20,
  },
  memberInfo: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  memberNameWithColor: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
  },
  colorIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  youLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: '#9ca3af',
  },
  editButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  memberStatus: {
    fontSize: 12,
    color: '#6b7280',
  },
  memberRole: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  creatorBadge: {
    backgroundColor: '#fbbf24',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    height: 24,
  },
  creatorText: {
    color: '#1a1a1a',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  leaveButton: {
    backgroundColor: '#ef4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    gap: 8,
  },
  leaveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Confirmation modal styles
  confirmationOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmationContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  confirmationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  confirmationTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
  confirmationBody: {
    padding: 20,
    alignItems: 'center',
  },
  confirmationText: {
    fontSize: 16,
    color: '#e5e7eb',
    textAlign: 'center',
    marginBottom: 8,
  },
  confirmationSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  confirmationButtons: {
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
  confirmLeaveButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmLeaveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});