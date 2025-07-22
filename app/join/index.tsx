import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { ApiService } from '@/services/api';
import { useGroups } from '@/contexts/GroupsContext';

interface InviteGroupData {
  id: string;
  name: string;
  description?: string;
  member_count: number;
  creator_name?: string;
}

export default function JoinGroupScreen() {
  const { loadGroups } = useGroups();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [groupData, setGroupData] = useState<InviteGroupData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    // Get code from URL using Expo Linking
    const getInviteCode = async () => {
      const url = await Linking.getInitialURL();
      if (url) {
        const codeMatch = url.match(/join\/([^?&]+)/);
        return codeMatch ? codeMatch[1] : null;
      }
      return null;
    };

    const processCode = async () => {
      const code = await getInviteCode();
      if (code) {
        processInvite(code);
      } else {
        setError('No invite code found in URL');
        setLoading(false);
      }
    };

    processCode();
  }, []);

  const processInvite = async (code: string) => {
    try {
      setLoading(true);
      const data = await ApiService.processInvite(code);
      setGroupData(data);
    } catch (error: any) {
      setError(error.message || 'Invalid invite link');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGroup = async () => {
    try {
      setJoining(true);
      const url = window.location.href;
      const codeMatch = url.match(/join\/([^?&]+)/);
      const code = codeMatch ? codeMatch[1] : null;
      
      if (!code) {
        setError('No invite code found');
        return;
      }
      
      await ApiService.joinGroup(code);
      await loadGroups(); // Refresh groups list
      
      // Navigate to the group
      router.replace({
        pathname: '/group/[id]',
        params: { id: groupData.id }
      });
    } catch (error: any) {
      setError(error.message || 'Failed to join group');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Processing invite...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top }]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="chevron-back" size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.centerContent}>
            <View style={styles.errorContainer}>
              <Ionicons name="warning" size={48} color="#ef4444" />
              <Text style={styles.errorTitle}>Invalid Invite</Text>
              <Text style={styles.errorText}>{error}</Text>
              
              <TouchableOpacity style={styles.homeButton} onPress={() => router.replace('/')}>
                <Text style={styles.homeButtonText}>Go Home</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.content}>
          <View style={styles.inviteCard}>
            <View style={styles.iconContainer}>
              <Ionicons name="people" size={48} color="#2563eb" />
            </View>
            
            <Text style={styles.title}>You're Invited!</Text>
            <Text style={styles.groupName}>{groupData?.name}</Text>
            
            {groupData?.description && (
              <Text style={styles.description}>{groupData.description}</Text>
            )}
            
            <View style={styles.memberInfo}>
              <Ionicons name="person" size={16} color="#9ca3af" />
              <Text style={styles.memberCount}>
                {groupData?.member_count} member{groupData?.member_count === 1 ? '' : 's'}
              </Text>
            </View>
            
            <TouchableOpacity 
              style={[styles.joinButton, joining && styles.joinButtonDisabled]} 
              onPress={handleJoinGroup}
              disabled={joining}
            >
              {joining ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="add" size={20} color="#ffffff" />
                  <Text style={styles.joinButtonText}>Join Group</Text>
                </>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
              <Text style={styles.cancelButtonText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  backButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#9ca3af',
    fontSize: 16,
    marginTop: 16,
  },
  inviteCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  groupName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2563eb',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  memberCount: {
    fontSize: 14,
    color: '#9ca3af',
    marginLeft: 4,
  },
  joinButton: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    marginBottom: 16,
  },
  joinButtonDisabled: {
    opacity: 0.6,
  },
  joinButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  cancelButton: {
    paddingVertical: 12,
  },
  cancelButtonText: {
    color: '#9ca3af',
    fontSize: 16,
  },
  errorContainer: {
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 24,
  },
  homeButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  homeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});