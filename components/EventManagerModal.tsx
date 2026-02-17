import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ApiService } from '@/services/api';
import { Event } from '@/contexts/GroupsContext';

interface EventManagerModalProps {
  visible: boolean;
  onClose: () => void;
}

type SortMode = 'date' | 'name' | 'newest';

export default function EventManagerModal({ visible, onClose }: EventManagerModalProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('newest');

  useEffect(() => {
    if (visible) {
      loadEvents();
    }
  }, [visible]);

  const loadEvents = async () => {
    setIsLoading(true);
    try {
      const { events: apiEvents } = await ApiService.getAllEvents();
      const mapped = apiEvents.map((e: any) => ({
        id: e.id,
        name: e.name || '',
        description: e.description || '',
        short_description: e.short_description || '',
        date: e.date || '',
        time: e.time || '',
        price: e.is_free ? 'Free' : (e.price ? `$${e.price}` : ''),
        distance: e.location || '',
        type: e.category || 'general',
        tags: e.tags || [],
        image_url: e.image_url || undefined,
        location: e.location || undefined,
        venue_name: e.venue_name || e.venueName || undefined,
      }));
      setEvents(mapped);
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = (event: Event) => {
    const doDelete = async () => {
      try {
        await ApiService.deleteGlobalEvent(event.id);
        setEvents(prev => prev.filter(e => e.id !== event.id));
      } catch (error) {
        console.error('Failed to delete event:', error);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Delete "${event.name}"?`)) {
        doDelete();
      }
    } else {
      Alert.alert('Delete Event', `Delete "${event.name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const handleEdit = (event: Event) => {
    onClose();
    setTimeout(() => {
      router.push({
        pathname: '/edit-event',
        params: { event: JSON.stringify(event) },
      });
    }, 300);
  };

  // Filter
  const filtered = events.filter(e =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (e.tags || []).some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    switch (sortMode) {
      case 'date': {
        const dateA = a.date?.split(' to ')[0] || '';
        const dateB = b.date?.split(' to ')[0] || '';
        return dateA.localeCompare(dateB);
      }
      case 'name':
        return a.name.localeCompare(b.name);
      case 'newest':
      default:
        return String(b.id).localeCompare(String(a.id));
    }
  });

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return 'No date';
    const part = dateStr.split(' to ')[0];
    const [y, m, d] = part.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderEvent = ({ item }: { item: Event }) => (
    <View style={styles.eventRow}>
      <TouchableOpacity style={styles.eventInfo} onPress={() => handleEdit(item)} activeOpacity={0.7}>
        <Text style={styles.eventName} numberOfLines={1}>{item.name}</Text>
        <View style={styles.eventMeta}>
          <Text style={styles.eventDate}>{formatDate(item.date)}</Text>
          {item.tags && item.tags.length > 0 && (
            <Text style={styles.eventTags} numberOfLines={1}>
              {item.tags.slice(0, 3).join(', ')}
            </Text>
          )}
        </View>
      </TouchableOpacity>
      <View style={styles.eventActions}>
        <TouchableOpacity onPress={() => handleEdit(item)} style={styles.actionButton}>
          <Ionicons name="create-outline" size={18} color="#60a5fa" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionButton}>
          <Ionicons name="trash-outline" size={18} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerSideButton}>
            <Ionicons name="close" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Events</Text>
          <Text style={[styles.headerSideButton, styles.eventCount]}>{events.length}</Text>
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={16} color="#6b7280" />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search events or tags..."
              placeholderTextColor="#6b7280"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color="#6b7280" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Sort Tabs */}
        <View style={styles.sortRow}>
          {([
            { key: 'newest', label: 'Newest' },
            { key: 'date', label: 'Date' },
            { key: 'name', label: 'Name' },
          ] as { key: SortMode; label: string }[]).map(s => (
            <TouchableOpacity
              key={s.key}
              style={[styles.sortTab, sortMode === s.key && styles.sortTabActive]}
              onPress={() => setSortMode(s.key)}
            >
              <Text style={[styles.sortTabText, sortMode === s.key && styles.sortTabTextActive]}>
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Event List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#60a5fa" />
          </View>
        ) : (
          <FlatList
            data={sorted}
            keyExtractor={item => String(item.id)}
            renderItem={renderEvent}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={48} color="#4a4a4a" />
                <Text style={styles.emptyText}>
                  {searchQuery ? 'No matching events' : 'No events yet'}
                </Text>
              </View>
            }
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    backgroundColor: '#1a1a1a',
  },
  headerSideButton: {
    width: 70,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
  },
  eventCount: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'right',
    fontWeight: '500',
  },
  searchRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
  },
  sortRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  sortTab: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  sortTabActive: {
    backgroundColor: '#60a5fa20',
    borderColor: '#60a5fa',
  },
  sortTabText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  sortTabTextActive: {
    color: '#60a5fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    gap: 6,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  eventInfo: {
    flex: 1,
    marginRight: 10,
  },
  eventName: {
    fontSize: 15,
    color: '#ffffff',
    fontWeight: '600',
    marginBottom: 4,
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  eventDate: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  eventTags: {
    fontSize: 12,
    color: '#6b7280',
    flex: 1,
  },
  eventActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#2a2a2a',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
});
