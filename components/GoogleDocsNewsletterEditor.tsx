import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Newsletter, NewsletterEvent } from '@/types/newsletter';
import { useNewsletter } from '@/contexts/NewsletterContext';
import EventBlockEditor from './EventBlockEditor';

const { width } = Dimensions.get('window');

interface GoogleDocsNewsletterEditorProps {
  newsletter?: Newsletter;
  onSave: (newsletter: Newsletter) => void;
  onCancel: () => void;
}

export default function GoogleDocsNewsletterEditor({ 
  newsletter, 
  onSave, 
  onCancel 
}: GoogleDocsNewsletterEditorProps) {
  const { createNewsletter, updateNewsletter } = useNewsletter();
  const router = useRouter();
  
  // Header fields
  const [title, setTitle] = useState(newsletter?.title || '');
  const [subtitle, setSubtitle] = useState(newsletter?.subtitle || '');
  const [date, setDate] = useState(newsletter?.date || new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }));
  const [readOnlineUrl, setReadOnlineUrl] = useState(newsletter?.readOnlineUrl || '');
  
  // Main content
  const [content, setContent] = useState(newsletter?.content || '');
  const [events, setEvents] = useState<NewsletterEvent[]>(newsletter?.events || []);
  
  // UI state
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [showFormatBar, setShowFormatBar] = useState(false);
  const [showEventEditor, setShowEventEditor] = useState(false);
  const [editingEvent, setEditingEvent] = useState<NewsletterEvent | null>(null);
  
  const contentInputRef = useRef<TextInput>(null);

  const insertFormatting = (before: string, after: string = '') => {
    const input = contentInputRef.current;
    if (!input) return;

    // For demo purposes, we'll just insert the formatting at cursor
    // In a real app, you'd want proper text selection handling
    const beforeText = content.substring(0, content.length);
    const afterText = content.substring(content.length);
    const newContent = beforeText + before + selectedText + after + afterText;
    setContent(newContent);
  };

  const insertHeading = (level: string) => {
    const headingText = `\n\n${level}\n`;
    setContent(prev => prev + headingText);
  };

  const insertBulletPoint = () => {
    setContent(prev => prev + '\n• ');
  };

  const handleAddLink = () => {
    setShowLinkModal(true);
  };

  const saveLink = () => {
    if (!selectedText.trim() || !linkUrl.trim()) {
      Alert.alert('Error', 'Please provide both link text and URL');
      return;
    }

    const linkMarkup = `[${selectedText}](${linkUrl})`;
    setContent(prev => prev + linkMarkup);
    setShowLinkModal(false);
    setSelectedText('');
    setLinkUrl('');
  };

  const handleEditEvent = (event: NewsletterEvent) => {
    setEditingEvent(event);
    setShowEventEditor(true);
  };

  const handleSaveEvent = (updatedEvent: NewsletterEvent) => {
    setEvents(events.map(e => e.id === updatedEvent.id ? updatedEvent : e));
  };

  const handleDeleteEvent = (eventId: string) => {
    setEvents(events.filter(e => e.id !== eventId));
  };

  const addNewEvent = () => {
    const newEvent: NewsletterEvent = {
      id: Date.now().toString(),
      title: '',
      description: '',
      time: '',
      location: '',
      date: '',
      isEditable: true,
    };
    setEvents([...events, newEvent]);
    setEditingEvent(newEvent);
    setShowEventEditor(true);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please provide a newsletter title');
      return;
    }

    try {
      const newsletterData = {
        title: title.trim(),
        subtitle: subtitle.trim(),
        date: date.trim(),
        readOnlineUrl: readOnlineUrl.trim(),
        content: content.trim(),
        events: events,
      };

      if (newsletter) {
        // Update existing newsletter
        await updateNewsletter(newsletter.id, newsletterData);
        onSave({ ...newsletter, ...newsletterData });
      } else {
        // Create new newsletter
        const newNewsletter = await createNewsletter(title.trim());
        await updateNewsletter(newNewsletter.id, newsletterData);
        onSave({ ...newNewsletter, ...newsletterData });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save newsletter');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Toolbar */}
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.toolbarButton} onPress={onCancel}>
          <Ionicons name="arrow-back" size={20} color="#60a5fa" />
          <Text style={styles.toolbarButtonText}>Back</Text>
        </TouchableOpacity>
        
        <View style={styles.toolbarCenter}>
          <Text style={styles.documentTitle}>
            {newsletter ? 'Edit Newsletter' : 'New Newsletter'}
          </Text>
        </View>

        <View style={styles.toolbarRight}>
          <TouchableOpacity
            style={styles.createEventButton}
            onPress={() => router.push('/create-event')}
          >
            <Ionicons name="add-circle-outline" size={20} color="#60a5fa" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Formatting Toolbar */}
      <View style={styles.formatToolbar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.formatToolbarContent}>
          <TouchableOpacity style={styles.formatButton} onPress={() => insertFormatting('**', '**')}>
            <Text style={[styles.formatButtonText, { fontWeight: 'bold' }]}>B</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.formatButton} onPress={() => insertFormatting('*', '*')}>
            <Text style={[styles.formatButtonText, { fontStyle: 'italic' }]}>I</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.formatButton} onPress={() => insertHeading('# ')}>
            <Text style={styles.formatButtonText}>H1</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.formatButton} onPress={() => insertHeading('## ')}>
            <Text style={styles.formatButtonText}>H2</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.formatButton} onPress={() => insertHeading('### ')}>
            <Text style={styles.formatButtonText}>H3</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.formatButton} onPress={insertBulletPoint}>
            <Ionicons name="list" size={16} color="#9ca3af" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.formatButton} onPress={handleAddLink}>
            <Ionicons name="link" size={16} color="#9ca3af" />
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Document Content */}
      <ScrollView style={styles.documentContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.document}>
          {/* Header Section */}
          <View style={styles.headerSection}>
            <TextInput
              style={styles.titleInput}
              value={title}
              onChangeText={setTitle}
              placeholder="Newsletter Title"
              placeholderTextColor="#6b7280"
              multiline
            />
            
            <TextInput
              style={styles.subtitleInput}
              value={subtitle}
              onChangeText={setSubtitle}
              placeholder="Subtitle (optional)"
              placeholderTextColor="#6b7280"
              multiline
            />
            
            <View style={styles.metaRow}>
              <TextInput
                style={styles.dateInput}
                value={date}
                onChangeText={setDate}
                placeholder="Date"
                placeholderTextColor="#6b7280"
              />
              
              <Text style={styles.metaSeparator}>|</Text>
              
              <TextInput
                style={styles.readOnlineInput}
                value={readOnlineUrl}
                onChangeText={setReadOnlineUrl}
                placeholder="Read Online URL (optional)"
                placeholderTextColor="#6b7280"
              />
            </View>
          </View>

          {/* Events Section */}
          {events.length > 0 && (
            <View style={styles.eventsSection}>
              <View style={styles.eventsSectionHeader}>
                <Text style={styles.eventsSectionTitle}>Events</Text>
                <TouchableOpacity style={styles.addEventButton} onPress={addNewEvent}>
                  <Ionicons name="add" size={20} color="#60a5fa" />
                  <Text style={styles.addEventButtonText}>Add Event</Text>
                </TouchableOpacity>
              </View>
              
              {events.map((event) => (
                <TouchableOpacity
                  key={event.id}
                  style={styles.eventBlock}
                  onPress={() => handleEditEvent(event)}
                >
                  <View style={styles.eventHeader}>
                    <Text style={styles.eventDate}>{event.date}</Text>
                    <Ionicons name="pencil-outline" size={16} color="#60a5fa" />
                  </View>
                  <Text style={styles.eventTitle}>{event.title || 'Untitled Event'}</Text>
                  <Text style={styles.eventDescription}>{event.description}</Text>
                  <Text style={styles.eventTime}>
                    {event.time} {event.location && `@ ${event.location}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Main Content Area */}
          <View style={styles.contentSection}>
            {events.length === 0 && (
              <TouchableOpacity style={styles.addEventsPrompt} onPress={addNewEvent}>
                <Ionicons name="calendar-outline" size={24} color="#60a5fa" />
                <Text style={styles.addEventsPromptText}>Add Events Section</Text>
              </TouchableOpacity>
            )}
            
            <TextInput
              ref={contentInputRef}
              style={styles.contentInput}
              value={content}
              onChangeText={setContent}
              placeholder="Start writing your newsletter content here...

You can use:
• **bold text**
• *italic text*
• # Large headings
• ## Medium headings  
• ### Small headings
• • Bullet points
• [link text](URL) for links

Share on social media section ideas:
• share on facebook
• share on twitter  
• share on linkedin

Content sections you might include:
• Highlights
• Local News
• Live Music
• Food & Dining"
              placeholderTextColor="#6b7280"
              multiline
              scrollEnabled={false}
              textAlignVertical="top"
            />
          </View>
        </View>
      </ScrollView>

      {/* Link Modal */}
      <Modal
        visible={showLinkModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.linkModalContainer}>
          <View style={styles.linkModalHeader}>
            <Text style={styles.linkModalTitle}>Add Link</Text>
            <TouchableOpacity onPress={() => setShowLinkModal(false)}>
              <Ionicons name="close" size={24} color="#9ca3af" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.linkModalContent}>
            <View style={styles.linkInputGroup}>
              <Text style={styles.linkInputLabel}>Link Text</Text>
              <TextInput
                style={styles.linkInput}
                value={selectedText}
                onChangeText={setSelectedText}
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
              <Text style={styles.linkSaveButtonText}>Insert Link</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Event Block Editor */}
      {editingEvent && (
        <EventBlockEditor
          event={editingEvent}
          visible={showEventEditor}
          onClose={() => {
            setShowEventEditor(false);
            setEditingEvent(null);
          }}
          onSave={handleSaveEvent}
          onDelete={() => {
            if (editingEvent) {
              handleDeleteEvent(editingEvent.id);
            }
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  toolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  toolbarButtonText: {
    fontSize: 16,
    color: '#60a5fa',
  },
  toolbarCenter: {
    flex: 1,
    alignItems: 'center',
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
  saveButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ffffff',
  },
  toolbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  createEventButton: {
    padding: 4,
  },
  formatToolbar: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  formatToolbarContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  formatButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 36,
  },
  formatButtonText: {
    fontSize: 14,
    color: '#374151',
  },
  documentContainer: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  document: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginVertical: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 700,
  },
  headerSection: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  titleInput: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitleInput: {
    fontSize: 18,
    color: '#6b7280',
    marginBottom: 16,
    textAlign: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dateInput: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  metaSeparator: {
    fontSize: 14,
    color: '#6b7280',
  },
  readOnlineInput: {
    fontSize: 14,
    color: '#60a5fa',
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  eventsSection: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  eventsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  eventsSectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
  },
  addEventButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#60a5fa',
  },
  addEventButtonText: {
    fontSize: 14,
    color: '#60a5fa',
    fontWeight: '500',
  },
  eventBlock: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  eventDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 8,
  },
  eventTime: {
    fontSize: 14,
    color: '#374151',
  },
  addEventsPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#60a5fa',
    borderStyle: 'dashed',
  },
  addEventsPromptText: {
    fontSize: 16,
    color: '#60a5fa',
    fontWeight: '500',
  },
  contentSection: {
    padding: 24,
  },
  contentInput: {
    fontSize: 16,
    color: '#1f2937',
    lineHeight: 24,
    minHeight: 500,
    textAlignVertical: 'top',
  },
  linkModalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  linkModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  linkModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
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
    color: '#374151',
    marginBottom: 8,
  },
  linkInput: {
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
    color: '#1f2937',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  linkSaveButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 20,
  },
  linkSaveButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
  },
});