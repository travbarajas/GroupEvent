import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  Modal,
  TextInput,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useNewsletter } from '@/contexts/NewsletterContext';
import { Newsletter } from '@/types/newsletter';
import GoogleDocsNewsletterEditor from '@/components/GoogleDocsNewsletterEditor';
import BlockBasedNewsletterEditor from '@/components/BlockBasedNewsletterEditor';
import StructuredNewsletterEditor from '@/components/StructuredNewsletterEditor';
import EnhancedNewsletterCreationModal from '@/components/EnhancedNewsletterCreationModal';
import NewsletterRenderer from '@/components/NewsletterRenderer';
import NotificationModal from '@/components/NotificationModal';

export default function NewsletterAdminScreen() {
  const router = useRouter();
  const {
    newsletters,
    loadNewsletters,
    createNewsletter,
    publishNewsletter,
    deleteNewsletter,
    isAdmin,
  } = useNewsletter();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editingNewsletter, setEditingNewsletter] = useState<Newsletter | null>(null);
  const [useBlockEditor, setUseBlockEditor] = useState(true); // Default to structured editor
  const [showPreview, setShowPreview] = useState(false);
  const [previewNewsletter, setPreviewNewsletter] = useState<Newsletter | null>(null);
  const [showNotificationModal, setShowNotificationModal] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      if (Platform.OS === 'web') {
        window.alert('Access Denied: You do not have permission to access this page.');
      } else {
        Alert.alert('Access Denied', 'You do not have permission to access this page.');
      }
      router.back();
      return;
    }
    loadNewsletters();
  }, [isAdmin]);

  const handleNewsletterCreated = (newsletter: Newsletter) => {
    setEditingNewsletter(newsletter);
    setShowEditor(true);
    loadNewsletters(); // Refresh the list
  };

  const handleEditNewsletter = (newsletter: Newsletter) => {
    setEditingNewsletter(newsletter);
    setShowEditor(true);
  };

  const handlePublishNewsletter = async (newsletter: Newsletter) => {
    if (newsletter.isPublished) {
      if (Platform.OS === 'web') {
        window.alert('This newsletter is already published');
      } else {
        Alert.alert('Info', 'This newsletter is already published');
      }
      return;
    }

    if (!newsletter.content || typeof newsletter.content !== 'string' || newsletter.content.trim().length === 0) {
      if (Platform.OS === 'web') {
        window.alert('Cannot publish an empty newsletter');
      } else {
        Alert.alert('Error', 'Cannot publish an empty newsletter');
      }
      return;
    }

    const performPublish = async () => {
      try {
        await publishNewsletter(newsletter.id);
        await loadNewsletters();
        if (Platform.OS === 'web') {
          window.alert('Newsletter published successfully!');
        } else {
          Alert.alert('Success', 'Newsletter published successfully!');
        }
      } catch (error) {
        if (Platform.OS === 'web') {
          window.alert('Failed to publish newsletter');
        } else {
          Alert.alert('Error', 'Failed to publish newsletter');
        }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to publish this newsletter? This will send push notifications to all users.')) {
        await performPublish();
      }
    } else {
      Alert.alert(
        'Publish Newsletter',
        'Are you sure you want to publish this newsletter? This will send push notifications to all users.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Publish',
            style: 'default',
            onPress: performPublish,
          },
        ]
      );
    }
  };

  const handleDeleteNewsletter = async (newsletter: Newsletter) => {
    const performDelete = async () => {
      try {
        await deleteNewsletter(newsletter.id);
      } catch (error) {
        if (Platform.OS === 'web') {
          window.alert('Failed to delete newsletter');
        } else {
          Alert.alert('Error', 'Failed to delete newsletter');
        }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to delete this newsletter? This action cannot be undone.')) {
        await performDelete();
      }
    } else {
      Alert.alert(
        'Delete Newsletter',
        'Are you sure you want to delete this newsletter? This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: performDelete,
          },
        ]
      );
    }
  };

  const handleEditorSave = (newsletter: Newsletter) => {
    setShowEditor(false);
    setEditingNewsletter(null);
    loadNewsletters(); // Refresh the list
  };

  const handleEditorCancel = () => {
    setShowEditor(false);
    setEditingNewsletter(null);
  };

  const handlePreviewNewsletter = (newsletter: Newsletter) => {
    setPreviewNewsletter(newsletter);
    setShowPreview(true);
  };

  const renderNewsletterItem = ({ item }: { item: Newsletter }) => (
    <View style={styles.newsletterItem}>
      <View style={styles.newsletterHeader}>
        <View style={styles.newsletterInfo}>
          <Text style={styles.newsletterTitle}>{item.title}</Text>
          <View style={styles.newsletterMeta}>
            <Text style={styles.newsletterDate}>
              Created {new Date(item.createdAt).toLocaleDateString()}
            </Text>
            {item.isPublished && (
              <View style={styles.publishedBadge}>
                <Text style={styles.publishedBadgeText}>Published</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.newsletterActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handlePreviewNewsletter(item)}
          >
            <Ionicons name="eye-outline" size={20} color="#a855f7" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleEditNewsletter(item)}
          >
            <Ionicons name="pencil-outline" size={20} color="#60a5fa" />
          </TouchableOpacity>

          {!item.isPublished && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handlePublishNewsletter(item)}
            >
              <Ionicons name="send-outline" size={20} color="#10b981" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDeleteNewsletter(item)}
          >
            <Ionicons name="trash-outline" size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
      
      <Text style={styles.newsletterContentPreview}>
        {item.content && typeof item.content === 'string' && item.content.trim().length > 0
          ? `${item.content.trim().length} characters`
          : 'No content yet'
        }
      </Text>
    </View>
  );

  if (!isAdmin) {
    return null; // Will redirect in useEffect
  }

  if (showEditor) {
    if (useBlockEditor) {
      return (
        <StructuredNewsletterEditor
          newsletter={editingNewsletter || undefined}
          onSave={handleEditorSave}
          onCancel={handleEditorCancel}
        />
      );
    } else {
      return (
        <GoogleDocsNewsletterEditor
          newsletter={editingNewsletter || undefined}
          onSave={handleEditorSave}
          onCancel={handleEditorCancel}
        />
      );
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#60a5fa" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Newsletter Admin</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowNotificationModal(true)}
          >
            <Ionicons name="notifications-outline" size={24} color="#f59e0b" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Ionicons name="add" size={24} color="#60a5fa" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Editor Toggle */}
      <View style={styles.editorToggle}>
        <Text style={styles.toggleLabel}>Editor:</Text>
        <TouchableOpacity 
          style={[styles.toggleButton, useBlockEditor && styles.activeToggle]}
          onPress={() => setUseBlockEditor(true)}
        >
          <Text style={[styles.toggleText, useBlockEditor && styles.activeToggleText]}>
            Structured Editor
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.toggleButton, !useBlockEditor && styles.activeToggle]}
          onPress={() => setUseBlockEditor(false)}
        >
          <Text style={[styles.toggleText, !useBlockEditor && styles.activeToggleText]}>
            Text Editor
          </Text>
        </TouchableOpacity>
      </View>

      {/* Newsletter List */}
      <FlatList
        data={newsletters.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())}
        keyExtractor={(item) => item.id}
        renderItem={renderNewsletterItem}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="newspaper-outline" size={64} color="#6b7280" />
            <Text style={styles.emptyStateTitle}>No Newsletters</Text>
            <Text style={styles.emptyStateText}>
              Create your first newsletter to get started!
            </Text>
          </View>
        }
      />

      {/* Enhanced Create Newsletter Modal */}
      <EnhancedNewsletterCreationModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onNewsletterCreated={handleNewsletterCreated}
      />

      {/* Preview Newsletter Modal */}
      <Modal
        visible={showPreview}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowPreview(false)}
      >
        <SafeAreaView style={styles.previewContainer}>
          <View style={styles.previewHeader}>
            <TouchableOpacity
              style={styles.previewCloseButton}
              onPress={() => setShowPreview(false)}
            >
              <Ionicons name="close" size={24} color="#ffffff" />
            </TouchableOpacity>
            <Text style={styles.previewHeaderTitle}>Newsletter Preview</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView
            style={styles.previewScrollView}
            contentContainerStyle={styles.previewContent}
            showsVerticalScrollIndicator={false}
          >
            {previewNewsletter && (
              <NewsletterRenderer newsletter={previewNewsletter} />
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Notifications Modal */}
      <NotificationModal
        visible={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  createButton: {
    padding: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    padding: 8,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 20,
  },
  newsletterItem: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  newsletterHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  newsletterInfo: {
    flex: 1,
    marginRight: 12,
  },
  newsletterTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  newsletterMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  newsletterDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  publishedBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  publishedBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  newsletterActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  newsletterContentPreview: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
  },
  editorToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#1f1f1f',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  toggleLabel: {
    fontSize: 14,
    color: '#9ca3af',
    marginRight: 12,
  },
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#2a2a2a',
    marginRight: 8,
  },
  activeToggle: {
    backgroundColor: '#3b82f6',
  },
  toggleText: {
    fontSize: 14,
    color: '#9ca3af',
    fontWeight: '500',
  },
  activeToggleText: {
    color: '#ffffff',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    backgroundColor: '#121212',
  },
  previewCloseButton: {
    padding: 8,
  },
  previewHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  previewScrollView: {
    flex: 1,
  },
  previewContent: {
    paddingBottom: 40,
  },
});