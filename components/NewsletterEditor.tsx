import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Newsletter, NewsletterContent } from '@/types/newsletter';
import { useNewsletter } from '@/contexts/NewsletterContext';

interface NewsletterEditorProps {
  newsletter?: Newsletter;
  onSave: (newsletter: Newsletter) => void;
  onCancel: () => void;
}

export default function NewsletterEditor({ newsletter, onSave, onCancel }: NewsletterEditorProps) {
  const { createNewsletter, updateNewsletter } = useNewsletter();
  const [title, setTitle] = useState(newsletter?.title || '');
  const [content, setContent] = useState<NewsletterContent[]>(newsletter?.content || []);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [linkText, setLinkText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  const addTextBlock = () => {
    const newItem: NewsletterContent = {
      id: Date.now().toString(),
      type: 'text',
      content: '',
      order: content.length,
    };
    setContent([...content, newItem]);
  };

  const addHeading = (level: 1 | 2 | 3) => {
    const newItem: NewsletterContent = {
      id: Date.now().toString(),
      type: 'heading',
      content: '',
      level,
      order: content.length,
    };
    setContent([...content, newItem]);
  };

  const addLink = () => {
    setLinkText('');
    setLinkUrl('');
    setEditingItemId(null);
    setShowLinkModal(true);
  };

  const saveLink = () => {
    if (!linkText.trim() || !linkUrl.trim()) {
      Alert.alert('Error', 'Please provide both link text and URL');
      return;
    }

    if (editingItemId) {
      // Edit existing link
      setContent(content.map(item => 
        item.id === editingItemId 
          ? { ...item, content: linkText, href: linkUrl }
          : item
      ));
    } else {
      // Add new link
      const newItem: NewsletterContent = {
        id: Date.now().toString(),
        type: 'link',
        content: linkText,
        href: linkUrl,
        order: content.length,
      };
      setContent([...content, newItem]);
    }

    setShowLinkModal(false);
    setEditingItemId(null);
  };

  const editLink = (item: NewsletterContent) => {
    setLinkText(item.content);
    setLinkUrl(item.href || '');
    setEditingItemId(item.id);
    setShowLinkModal(true);
  };

  const updateContent = (id: string, newContent: string) => {
    setContent(content.map(item =>
      item.id === id ? { ...item, content: newContent } : item
    ));
  };

  const deleteItem = (id: string) => {
    setContent(content.filter(item => item.id !== id));
  };

  const moveItem = (id: string, direction: 'up' | 'down') => {
    const index = content.findIndex(item => item.id === id);
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === content.length - 1)
    ) {
      return;
    }

    const newContent = [...content];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Swap items
    [newContent[index], newContent[targetIndex]] = [newContent[targetIndex], newContent[index]];
    
    // Update order
    newContent.forEach((item, idx) => {
      item.order = idx;
    });

    setContent(newContent);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please provide a newsletter title');
      return;
    }

    try {
      if (newsletter) {
        // Update existing newsletter
        await updateNewsletter(newsletter.id, {
          title: title.trim(),
          content: content.map((item, index) => ({ ...item, order: index })),
        });
        onSave({ ...newsletter, title: title.trim(), content });
      } else {
        // Create new newsletter
        const newNewsletter = await createNewsletter(title.trim());
        await updateNewsletter(newNewsletter.id, {
          content: content.map((item, index) => ({ ...item, order: index })),
        });
        onSave({ ...newNewsletter, content });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save newsletter');
    }
  };

  const renderContentItem = (item: NewsletterContent, index: number) => {
    const isFirst = index === 0;
    const isLast = index === content.length - 1;

    return (
      <View key={item.id} style={styles.contentItem}>
        <View style={styles.contentItemHeader}>
          <View style={styles.contentItemControls}>
            <TouchableOpacity
              style={[styles.controlButton, isFirst && styles.disabledButton]}
              onPress={() => moveItem(item.id, 'up')}
              disabled={isFirst}
            >
              <Ionicons name="chevron-up" size={16} color={isFirst ? "#4a4a4a" : "#9ca3af"} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.controlButton, isLast && styles.disabledButton]}
              onPress={() => moveItem(item.id, 'down')}
              disabled={isLast}
            >
              <Ionicons name="chevron-down" size={16} color={isLast ? "#4a4a4a" : "#9ca3af"} />
            </TouchableOpacity>
          </View>
          <View style={styles.contentTypeLabel}>
            <Text style={styles.contentTypeText}>
              {item.type === 'heading' ? `H${item.level}` : item.type.toUpperCase()}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => deleteItem(item.id)}
          >
            <Ionicons name="trash-outline" size={16} color="#ef4444" />
          </TouchableOpacity>
        </View>

        {item.type === 'link' ? (
          <TouchableOpacity style={styles.linkEditContainer} onPress={() => editLink(item)}>
            <Text style={styles.linkEditText}>{item.content}</Text>
            <Text style={styles.linkEditUrl}>{item.href}</Text>
            <Ionicons name="pencil-outline" size={16} color="#60a5fa" />
          </TouchableOpacity>
        ) : (
          <TextInput
            style={[
              styles.contentInput,
              item.type === 'heading' && styles.headingInput,
            ]}
            value={item.content}
            onChangeText={(text) => updateContent(item.id, text)}
            placeholder={
              item.type === 'heading' 
                ? `Heading ${item.level}...` 
                : 'Enter text...'
            }
            placeholderTextColor="#6b7280"
            multiline
          />
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Title Input */}
        <View style={styles.titleSection}>
          <Text style={styles.sectionLabel}>Newsletter Title</Text>
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Enter newsletter title..."
            placeholderTextColor="#6b7280"
          />
        </View>

        {/* Content Blocks */}
        <View style={styles.contentSection}>
          <Text style={styles.sectionLabel}>Content</Text>
          {content.map((item, index) => renderContentItem(item, index))}
        </View>

        {/* Add Content Buttons */}
        <View style={styles.addButtonsSection}>
          <TouchableOpacity style={styles.addButton} onPress={addTextBlock}>
            <Ionicons name="text-outline" size={20} color="#60a5fa" />
            <Text style={styles.addButtonText}>Add Text</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.addButton} onPress={() => addHeading(1)}>
            <Ionicons name="text" size={20} color="#60a5fa" />
            <Text style={styles.addButtonText}>Add H1</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.addButton} onPress={() => addHeading(2)}>
            <Ionicons name="text" size={18} color="#60a5fa" />
            <Text style={styles.addButtonText}>Add H2</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.addButton} onPress={() => addHeading(3)}>
            <Ionicons name="text" size={16} color="#60a5fa" />
            <Text style={styles.addButtonText}>Add H3</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.addButton} onPress={addLink}>
            <Ionicons name="link-outline" size={20} color="#60a5fa" />
            <Text style={styles.addButtonText}>Add Link</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>

      {/* Link Modal */}
      <Modal
        visible={showLinkModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.linkModalContainer}>
          <View style={styles.linkModalHeader}>
            <Text style={styles.linkModalTitle}>
              {editingItemId ? 'Edit Link' : 'Add Link'}
            </Text>
            <TouchableOpacity onPress={() => setShowLinkModal(false)}>
              <Ionicons name="close" size={24} color="#9ca3af" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.linkModalContent}>
            <View style={styles.linkInputGroup}>
              <Text style={styles.linkInputLabel}>Link Text</Text>
              <TextInput
                style={styles.linkInput}
                value={linkText}
                onChangeText={setLinkText}
                placeholder="Enter link text..."
                placeholderTextColor="#6b7280"
              />
            </View>
            
            <View style={styles.linkInputGroup}>
              <Text style={styles.linkInputLabel}>URL</Text>
              <TextInput
                style={styles.linkInput}
                value={linkUrl}
                onChangeText={setLinkUrl}
                placeholder="https://..."
                placeholderTextColor="#6b7280"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            
            <TouchableOpacity style={styles.linkSaveButton} onPress={saveLink}>
              <Text style={styles.linkSaveButtonText}>Save Link</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  titleSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  titleInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  contentSection: {
    marginBottom: 24,
  },
  contentItem: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  contentItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  contentItemControls: {
    flexDirection: 'row',
    marginRight: 12,
  },
  controlButton: {
    padding: 4,
    marginRight: 4,
  },
  disabledButton: {
    opacity: 0.3,
  },
  contentTypeLabel: {
    flex: 1,
  },
  contentTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#60a5fa',
    textTransform: 'uppercase',
  },
  deleteButton: {
    padding: 4,
  },
  contentInput: {
    fontSize: 16,
    color: '#ffffff',
    minHeight: 40,
    textAlignVertical: 'top',
  },
  headingInput: {
    fontWeight: '600',
    fontSize: 18,
  },
  linkEditContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  linkEditText: {
    flex: 1,
    fontSize: 16,
    color: '#60a5fa',
    textDecorationLine: 'underline',
  },
  linkEditUrl: {
    fontSize: 12,
    color: '#9ca3af',
    maxWidth: 100,
  },
  addButtonsSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3a3a3a',
    gap: 6,
  },
  addButtonText: {
    fontSize: 14,
    color: '#60a5fa',
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#3a3a3a',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9ca3af',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  linkModalContainer: {
    flex: 1,
    backgroundColor: '#121212',
  },
  linkModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  linkModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  linkModalContent: {
    padding: 20,
  },
  linkInputGroup: {
    marginBottom: 20,
  },
  linkInputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ffffff',
    marginBottom: 8,
  },
  linkInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  linkSaveButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  linkSaveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});