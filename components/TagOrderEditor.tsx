import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  FlatList,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiService } from '@/services/api';

interface Tag {
  tag_name: string;
  sort_order: number;
}

interface TagOrderEditorProps {
  visible: boolean;
  onClose: () => void;
}

export default function TagOrderEditor({ visible, onClose }: TagOrderEditorProps) {
  const insets = useSafeAreaInsets();
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (visible) {
      loadTags();
    }
  }, [visible]);

  const loadTags = async () => {
    setIsLoading(true);
    try {
      const { tags: serverTags } = await ApiService.getTagOrder();
      setTags(serverTags);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to load tags:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const moveTagUp = (index: number) => {
    if (index <= 0) return;
    setTags(prev => {
      const newTags = [...prev];
      [newTags[index - 1], newTags[index]] = [newTags[index], newTags[index - 1]];
      return newTags.map((t, i) => ({ ...t, sort_order: i }));
    });
    setHasChanges(true);
  };

  const moveTagDown = (index: number) => {
    setTags(prev => {
      if (index >= prev.length - 1) return prev;
      const newTags = [...prev];
      [newTags[index], newTags[index + 1]] = [newTags[index + 1], newTags[index]];
      return newTags.map((t, i) => ({ ...t, sort_order: i }));
    });
    setHasChanges(true);
  };

  const handleAddTag = async () => {
    const trimmed = newTagName.trim();
    if (!trimmed) return;

    if (tags.some(t => t.tag_name.toLowerCase() === trimmed.toLowerCase())) {
      const msg = 'This tag already exists';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Duplicate', msg);
      }
      return;
    }

    try {
      await ApiService.addTag(trimmed);
      setNewTagName('');
      await loadTags();
    } catch (error) {
      console.error('Failed to add tag:', error);
    }
  };

  const handleDeleteTag = (tagName: string) => {
    const doDelete = async () => {
      try {
        await ApiService.deleteTag(tagName);
        await loadTags();
      } catch (error) {
        console.error('Failed to delete tag:', error);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Delete tag "${tagName}"?`)) {
        doDelete();
      }
    } else {
      Alert.alert('Delete Tag', `Delete "${tagName}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await ApiService.saveTagOrder(tags);
      setHasChanges(false);
      const msg = 'Tag order saved';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Saved', msg);
      }
    } catch (error) {
      console.error('Failed to save tag order:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setHasChanges(false);
    onClose();
  };

  const renderTagItem = ({ item, index }: { item: Tag; index: number }) => (
    <View style={styles.tagRow}>
      <Text style={styles.tagIndex}>{index + 1}</Text>
      <Text style={styles.tagName}>{item.tag_name}</Text>
      <View style={styles.tagActions}>
        <TouchableOpacity
          onPress={() => moveTagUp(index)}
          disabled={index === 0}
          style={[styles.moveButton, index === 0 && styles.moveButtonDisabled]}
        >
          <Ionicons name="chevron-up" size={18} color={index === 0 ? '#3a3a3a' : '#9ca3af'} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => moveTagDown(index)}
          disabled={index === tags.length - 1}
          style={[styles.moveButton, index === tags.length - 1 && styles.moveButtonDisabled]}
        >
          <Ionicons name="chevron-down" size={18} color={index === tags.length - 1 ? '#3a3a3a' : '#9ca3af'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDeleteTag(item.tag_name)} style={styles.deleteButton}>
          <Ionicons name="trash-outline" size={16} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleClose}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.headerSideButton}>
            <Ionicons name="close" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tag Order</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={!hasChanges || isSaving}
            style={styles.headerSideButton}
          >
            <Text style={[styles.saveText, (!hasChanges || isSaving) && styles.saveTextDisabled]}>
              {isSaving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Add Tag Row */}
        <View style={styles.addTagRow}>
          <TextInput
            style={styles.addTagInput}
            value={newTagName}
            onChangeText={setNewTagName}
            placeholder="New tag name..."
            placeholderTextColor="#6b7280"
            autoCapitalize="none"
            onSubmitEditing={handleAddTag}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[styles.addButton, !newTagName.trim() && styles.addButtonDisabled]}
            onPress={handleAddTag}
            disabled={!newTagName.trim()}
          >
            <Ionicons name="add" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Tag List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#60a5fa" />
          </View>
        ) : (
          <FlatList
            data={tags}
            keyExtractor={(item) => item.tag_name}
            renderItem={renderTagItem}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="pricetags-outline" size={48} color="#4a4a4a" />
                <Text style={styles.emptyText}>No tags configured</Text>
                <Text style={styles.emptySubtext}>Add tags to control the row order on the Explore screen</Text>
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
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
    textAlign: 'right',
  },
  saveTextDisabled: {
    color: '#3a3a3a',
  },
  addTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  addTagInput: {
    flex: 1,
    height: 42,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    paddingHorizontal: 14,
    color: '#ffffff',
    fontSize: 15,
  },
  addButton: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    backgroundColor: '#1e3a5f',
  },
  listContent: {
    padding: 16,
    gap: 8,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  tagIndex: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
    width: 28,
  },
  tagName: {
    flex: 1,
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '500',
  },
  tagActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  moveButton: {
    padding: 6,
  },
  moveButtonDisabled: {
    opacity: 0.4,
  },
  deleteButton: {
    padding: 6,
    marginLeft: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  emptySubtext: {
    fontSize: 14,
    color: '#4a4a4a',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
