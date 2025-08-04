import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GroupChat from '@/components/GroupChat';

export default function GroupChatScreen() {
  const { groupId, groupName, currentUsername } = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header - matching app design */}
      <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={styles.leftButtons}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="chevron-back" size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>
          <View style={styles.headerGroupInfo}>
            <Text style={styles.headerGroupName}>{groupName as string}</Text>
            <Text style={styles.headerSubtitle}>Group Chat</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>
      </View>
      
      {/* Chat Component */}
      <GroupChat 
        groupId={groupId as string}
        currentUsername={currentUsername as string}
        modalVisible={true}
        standalone={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  headerContainer: {
    backgroundColor: '#1a1a1a',
  },
  header: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 4,
  },
  headerGroupInfo: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  headerGroupName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 2,
  },
  headerSpacer: {
    width: 32, // Same width as back button to center title
  },
});