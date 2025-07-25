import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useGroups, Group, Event } from '../contexts/GroupsContext';

export default function GroupSelectionScreen() {
  const { groups } = useGroups();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  
  // Parse the event data from params
  const event: Event | null = params.event ? JSON.parse(params.event as string) : null;

  const handleGroupSelect = (group: Group) => {
    if (event) {
      // Navigate to group page with event data
      router.push({
        pathname: '/group/[id]',
        params: { 
          id: group.id,
          pendingEvent: JSON.stringify(event)
        }
      });
    }
  };

  if (!event) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Group Selection</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Event data not available</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Add to Group</Text>
          <Text style={styles.headerSubtitle}>Choose a group for "{event.name}"</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.groupsList}>
          {groups.filter(group => group != null).map((group) => (
            <TouchableOpacity 
              key={group.id} 
              style={styles.groupItem}
              onPress={() => handleGroupSelect(group)}
              activeOpacity={0.7}
            >
              <View style={styles.groupIcon}>
                <Ionicons name="people" size={20} color="#60a5fa" />
              </View>
              <View style={styles.groupInfo}>
                <Text style={styles.groupName}>{group?.name || 'Unnamed Group'}</Text>
                <Text style={styles.groupMemberCount}>
                  {group?.memberCount || 0} member{(group?.memberCount || 0) === 1 ? '' : 's'}
                </Text>
              </View>
              <View style={styles.groupArrow}>
                <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
              </View>
            </TouchableOpacity>
          ))}
          
          {groups.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={64} color="#4b5563" />
              <Text style={styles.emptyTitle}>No Groups</Text>
              <Text style={styles.emptySubtitle}>
                Create a group first to add events to it
              </Text>
              <TouchableOpacity 
                style={styles.createGroupButton}
                onPress={() => router.push('/')}
              >
                <Ionicons name="add" size={18} color="#ffffff" />
                <Text style={styles.createGroupButtonText}>Create Group</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
  },
  headerSpacer: {
    width: 40,
  },
  scrollContainer: {
    flex: 1,
  },
  groupsList: {
    padding: 20,
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  groupIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1e3a8a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  groupMemberCount: {
    fontSize: 14,
    color: '#9ca3af',
  },
  groupArrow: {
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  createGroupButton: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  createGroupButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#9ca3af',
  },
});