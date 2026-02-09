import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ApiService } from '@/services/api';

interface Notification {
  id: string;
  title: string;
  body: string;
  status: 'draft' | 'scheduled' | 'sent';
  scheduled_for: string | null;
  sent_at: string | null;
  created_at: string;
}

interface NotificationModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function NotificationModal({ visible, onClose }: NotificationModalProps) {
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingNotification, setEditingNotification] = useState<Notification | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      loadNotifications();
    }
  }, [visible]);

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const { notifications: data } = await ApiService.getNotifications();
      setNotifications(data || []);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setBody('');
    setScheduledDate(null);
    setEditingNotification(null);
  };

  const handleClose = () => {
    resetForm();
    setShowCreateForm(false);
    onClose();
  };

  const handleCreateNew = () => {
    resetForm();
    setShowCreateForm(true);
  };

  const handleEdit = (notification: Notification) => {
    setTitle(notification.title);
    setBody(notification.body);
    setScheduledDate(notification.scheduled_for ? new Date(notification.scheduled_for) : null);
    setEditingNotification(notification);
    setShowCreateForm(true);
  };

  const handleSaveDraft = async () => {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Error', 'Please fill in both title and message');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingNotification) {
        await ApiService.updateNotification(editingNotification.id, {
          title: title.trim(),
          body: body.trim(),
        });
      } else {
        await ApiService.createNotification({
          title: title.trim(),
          body: body.trim(),
        });
      }
      await loadNotifications();
      resetForm();
      setShowCreateForm(false);
    } catch (error) {
      console.error('Failed to save notification:', error);
      Alert.alert('Error', 'Failed to save notification');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSchedule = async () => {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Error', 'Please fill in both title and message');
      return;
    }

    if (!scheduledDate) {
      setShowDatePicker(true);
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingNotification) {
        await ApiService.updateNotification(editingNotification.id, {
          title: title.trim(),
          body: body.trim(),
          scheduled_for: scheduledDate.toISOString(),
        });
      } else {
        await ApiService.createNotification({
          title: title.trim(),
          body: body.trim(),
          scheduled_for: scheduledDate.toISOString(),
        });
      }
      await loadNotifications();
      resetForm();
      setShowCreateForm(false);
    } catch (error) {
      console.error('Failed to schedule notification:', error);
      Alert.alert('Error', 'Failed to schedule notification');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublishNow = async () => {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Error', 'Please fill in both title and message');
      return;
    }

    // First confirmation
    const confirmFirst = Platform.OS === 'web'
      ? window.confirm('Are you sure you want to send this notification to all users?')
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Send Notification',
            'Are you sure you want to send this notification to all users?',
            [
              { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
              { text: 'Continue', onPress: () => resolve(true) }
            ]
          );
        });

    if (!confirmFirst) return;

    // Second confirmation
    const confirmSecond = Platform.OS === 'web'
      ? window.confirm('This will send a push notification immediately. This cannot be undone. Proceed?')
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Confirm Send',
            'This will send a push notification immediately. This cannot be undone. Proceed?',
            [
              { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
              { text: 'Send', onPress: () => resolve(true), style: 'destructive' }
            ]
          );
        });

    if (!confirmSecond) return;

    setIsSubmitting(true);
    try {
      let notificationId = editingNotification?.id;

      // If creating new, save first
      if (!notificationId) {
        const created = await ApiService.createNotification({
          title: title.trim(),
          body: body.trim(),
        });
        notificationId = created.id;
      } else {
        // Update existing
        await ApiService.updateNotification(notificationId, {
          title: title.trim(),
          body: body.trim(),
        });
      }

      // Send the notification
      await ApiService.sendNotification(notificationId);

      Alert.alert('Success', 'Notification sent successfully!');
      await loadNotifications();
      resetForm();
      setShowCreateForm(false);
    } catch (error) {
      console.error('Failed to send notification:', error);
      Alert.alert('Error', 'Failed to send notification');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendExisting = async (notification: Notification) => {
    // First confirmation
    const confirmFirst = Platform.OS === 'web'
      ? window.confirm(`Send "${notification.title}" to all users?`)
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Send Notification',
            `Send "${notification.title}" to all users?`,
            [
              { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
              { text: 'Continue', onPress: () => resolve(true) }
            ]
          );
        });

    if (!confirmFirst) return;

    // Second confirmation
    const confirmSecond = Platform.OS === 'web'
      ? window.confirm('This cannot be undone. Proceed?')
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Confirm',
            'This cannot be undone. Proceed?',
            [
              { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
              { text: 'Send', onPress: () => resolve(true), style: 'destructive' }
            ]
          );
        });

    if (!confirmSecond) return;

    try {
      await ApiService.sendNotification(notification.id);
      Alert.alert('Success', 'Notification sent!');
      await loadNotifications();
    } catch (error) {
      console.error('Failed to send:', error);
      Alert.alert('Error', 'Failed to send notification');
    }
  };

  const handleDelete = async (notification: Notification) => {
    const confirm = Platform.OS === 'web'
      ? window.confirm(`Delete "${notification.title}"?`)
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Delete Notification',
            `Delete "${notification.title}"?`,
            [
              { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
              { text: 'Delete', onPress: () => resolve(true), style: 'destructive' }
            ]
          );
        });

    if (!confirm) return;

    try {
      await ApiService.deleteNotification(notification.id);
      await loadNotifications();
    } catch (error) {
      console.error('Failed to delete:', error);
      Alert.alert('Error', 'Failed to delete notification');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return '#10b981';
      case 'scheduled': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const renderNotificationItem = ({ item }: { item: Notification }) => (
    <View style={styles.notificationItem}>
      <View style={styles.notificationHeader}>
        <Text style={styles.notificationTitle}>{item.title}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
        </View>
      </View>
      <Text style={styles.notificationBody} numberOfLines={2}>{item.body}</Text>
      <View style={styles.notificationMeta}>
        {item.scheduled_for && item.status === 'scheduled' && (
          <Text style={styles.metaText}>Scheduled: {formatDate(item.scheduled_for)}</Text>
        )}
        {item.sent_at && (
          <Text style={styles.metaText}>Sent: {formatDate(item.sent_at)}</Text>
        )}
        {!item.scheduled_for && !item.sent_at && (
          <Text style={styles.metaText}>Created: {formatDate(item.created_at)}</Text>
        )}
      </View>
      <View style={styles.notificationActions}>
        {item.status !== 'sent' && (
          <>
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleEdit(item)}>
              <Ionicons name="create-outline" size={18} color="#60a5fa" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleSendExisting(item)}>
              <Ionicons name="send" size={18} color="#10b981" />
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(item)}>
          <Ionicons name="trash-outline" size={18} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {showCreateForm ? (editingNotification ? 'Edit Notification' : 'Create Notification') : 'Notifications'}
          </Text>
          {!showCreateForm && (
            <TouchableOpacity onPress={handleCreateNew} style={styles.addButton}>
              <Ionicons name="add" size={24} color="#60a5fa" />
            </TouchableOpacity>
          )}
          {showCreateForm && <View style={{ width: 40 }} />}
        </View>

        {showCreateForm ? (
          <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
            {/* Title Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Notification Title *</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Enter notification title"
                placeholderTextColor="#6b7280"
                maxLength={100}
              />
            </View>

            {/* Body Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Message *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={body}
                onChangeText={setBody}
                placeholder="Enter notification message"
                placeholderTextColor="#6b7280"
                multiline
                numberOfLines={4}
                maxLength={500}
              />
            </View>

            {/* Scheduled Date Display */}
            {scheduledDate && (
              <View style={styles.scheduledInfo}>
                <Ionicons name="calendar" size={18} color="#f59e0b" />
                <Text style={styles.scheduledText}>
                  Scheduled for: {scheduledDate.toLocaleString()}
                </Text>
                <TouchableOpacity onPress={() => setScheduledDate(null)}>
                  <Ionicons name="close-circle" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
            )}

            {/* Date Picker */}
            {showDatePicker && (
              <DateTimePicker
                value={scheduledDate || new Date()}
                mode="datetime"
                display="default"
                minimumDate={new Date()}
                onChange={(event, date) => {
                  setShowDatePicker(false);
                  if (date) {
                    setScheduledDate(date);
                  }
                }}
              />
            )}

            {/* Action Buttons */}
            <View style={styles.formActions}>
              <TouchableOpacity
                style={[styles.formBtn, styles.draftBtn]}
                onPress={handleSaveDraft}
                disabled={isSubmitting}
              >
                <Ionicons name="document-outline" size={18} color="#9ca3af" />
                <Text style={styles.draftBtnText}>Save Draft</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.formBtn, styles.scheduleBtn]}
                onPress={() => scheduledDate ? handleSchedule() : setShowDatePicker(true)}
                disabled={isSubmitting}
              >
                <Ionicons name="calendar-outline" size={18} color="#f59e0b" />
                <Text style={styles.scheduleBtnText}>
                  {scheduledDate ? 'Save Scheduled' : 'Schedule'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.formBtn, styles.publishBtn]}
                onPress={handlePublishNow}
                disabled={isSubmitting}
              >
                <Ionicons name="send" size={18} color="#ffffff" />
                <Text style={styles.publishBtnText}>Publish Now</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.cancelFormBtn}
              onPress={() => {
                resetForm();
                setShowCreateForm(false);
              }}
            >
              <Text style={styles.cancelFormText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : (
          <FlatList
            data={notifications}
            renderItem={renderNotificationItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="notifications-outline" size={48} color="#6b7280" />
                <Text style={styles.emptyText}>No notifications yet</Text>
                <Text style={styles.emptySubtext}>Tap + to create one</Text>
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    backgroundColor: '#1a1a1a',
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  addButton: {
    padding: 8,
  },
  listContainer: {
    padding: 16,
  },
  notificationItem: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
  notificationBody: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 8,
  },
  notificationMeta: {
    marginBottom: 12,
  },
  metaText: {
    fontSize: 12,
    color: '#6b7280',
  },
  notificationActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  actionBtn: {
    padding: 8,
  },
  formContainer: {
    flex: 1,
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#ffffff',
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  scheduledInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    gap: 8,
  },
  scheduledText: {
    flex: 1,
    color: '#f59e0b',
    fontSize: 14,
  },
  formActions: {
    gap: 12,
    marginBottom: 20,
  },
  formBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  draftBtn: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  draftBtnText: {
    color: '#9ca3af',
    fontSize: 16,
    fontWeight: '600',
  },
  scheduleBtn: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  scheduleBtnText: {
    color: '#f59e0b',
    fontSize: 16,
    fontWeight: '600',
  },
  publishBtn: {
    backgroundColor: '#10b981',
  },
  publishBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelFormBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 40,
  },
  cancelFormText: {
    color: '#6b7280',
    fontSize: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#9ca3af',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
});
