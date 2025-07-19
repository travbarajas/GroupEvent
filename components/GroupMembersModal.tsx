import React from 'react';
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
  needs_profile: boolean;
}

interface GroupMembersModalProps {
  visible: boolean;
  onClose: () => void;
  members: Member[];
  groupName: string;
  onLeaveGroup: () => void;
  currentUserRole?: string;
}

export default function GroupMembersModal({ 
  visible, 
  onClose, 
  members, 
  groupName, 
  onLeaveGroup,
  currentUserRole 
}: GroupMembersModalProps) {
  
  const MemberItem = ({ member }: { member: Member }) => (
    <View style={styles.memberItem}>
      <View style={styles.memberAvatar}>
        {member.profile_picture ? (
          <Text style={styles.avatarEmoji}>{member.profile_picture}</Text>
        ) : (
          <Ionicons name="person" size={20} color="#9ca3af" />
        )}
      </View>
      
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>
          {member.username || `User ${member.device_id.substring(0, 8)}...`}
        </Text>
        {member.needs_profile && (
          <Text style={styles.memberStatus}>Profile not set up</Text>
        )}
      </View>
      
      <View style={styles.memberRole}>
        {member.role === 'creator' && (
          <View style={styles.creatorBadge}>
            <Ionicons name="star" size={12} color="#fbbf24" />
            <Text style={styles.creatorText}>Creator</Text>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
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
              onPress={onLeaveGroup}
            >
              <Ionicons name="exit-outline" size={20} color="#ffffff" />
              <Text style={styles.leaveButtonText}>Leave Group</Text>
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
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  memberStatus: {
    fontSize: 12,
    color: '#6b7280',
  },
  memberRole: {
    alignItems: 'flex-end',
  },
  creatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fbbf24',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  creatorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a1a1a',
    marginLeft: 4,
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
});