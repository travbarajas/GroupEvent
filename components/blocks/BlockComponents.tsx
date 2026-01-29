import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Image,
  Linking,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  NewsletterBlock,
  HeadingBlock,
  ParagraphBlock,
  ContentBreakBlock,
  ImageBlock,
  ButtonBlock,
  EventListBlock,
} from '@/types/blocks';
import { ApiService } from '@/services/api';

interface BlockComponentProps {
  block: NewsletterBlock;
  isSelected: boolean;
  isEditing: boolean;
  onUpdate: (block: NewsletterBlock) => void;
  onDelete: () => void;
  onDragStart: () => void;
  onEdit: () => void;
  onStopEditing: () => void;
}

// Heading Block Component
export const HeadingBlockComponent: React.FC<BlockComponentProps & { block: HeadingBlock }> = ({
  block,
  isSelected,
  isEditing,
  onUpdate,
  onDelete,
  onDragStart,
  onEdit,
  onStopEditing,
}) => {
  const getFontSize = () => {
    switch (block.type) {
      case 'heading-1': return 32;
      case 'heading-2': return 28;
      case 'heading-3': return 24;
      case 'heading-4': return 20;
      default: return 24;
    }
  };

  const getHeadingLevel = () => {
    switch (block.type) {
      case 'heading-1': return 'H1';
      case 'heading-2': return 'H2';
      case 'heading-3': return 'H3';
      case 'heading-4': return 'H4';
      default: return 'H1';
    }
  };

  return (
    <View style={[styles.blockContainer, isSelected && styles.selectedBlock]}>
      <View style={styles.blockHeader}>
        <View style={styles.blockInfo}>
          <Text style={styles.blockType}>{getHeadingLevel()}</Text>
          <TouchableOpacity style={styles.dragHandle} onPressIn={onDragStart}>
            <Ionicons name="reorder-three" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>
        <View style={styles.blockActions}>
          <TouchableOpacity onPress={onEdit} style={styles.actionButton}>
            <Ionicons name="pencil" size={16} color="#60a5fa" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={styles.actionButton}>
            <Ionicons name="trash" size={16} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
      
      {isEditing ? (
        <View style={styles.editingContainer}>
          <TextInput
            style={[styles.headingInput, { fontSize: getFontSize() }]}
            value={block.content}
            onChangeText={(content) => onUpdate({ ...block, content })}
            placeholder={`Enter ${getHeadingLevel()} heading...`}
            multiline
            autoFocus
          />
          <TouchableOpacity style={styles.doneButton} onPress={onStopEditing}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={onEdit}>
          <Text style={[styles.headingText, { fontSize: getFontSize() }]}>
            {block.content || `Tap to add ${getHeadingLevel()} heading`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// Paragraph Block Component
export const ParagraphBlockComponent: React.FC<BlockComponentProps & { block: ParagraphBlock }> = ({
  block,
  isSelected,
  isEditing,
  onUpdate,
  onDelete,
  onDragStart,
  onEdit,
  onStopEditing,
}) => {
  return (
    <View style={[styles.blockContainer, isSelected && styles.selectedBlock]}>
      <View style={styles.blockHeader}>
        <View style={styles.blockInfo}>
          <Text style={styles.blockType}>¶</Text>
          <TouchableOpacity style={styles.dragHandle} onPressIn={onDragStart}>
            <Ionicons name="reorder-three" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>
        <View style={styles.blockActions}>
          <TouchableOpacity onPress={onEdit} style={styles.actionButton}>
            <Ionicons name="pencil" size={16} color="#60a5fa" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={styles.actionButton}>
            <Ionicons name="trash" size={16} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
      
      {isEditing ? (
        <View style={styles.editingContainer}>
          <TextInput
            style={styles.paragraphInput}
            value={block.content}
            onChangeText={(content) => onUpdate({ ...block, content })}
            placeholder="Enter paragraph text..."
            multiline
            autoFocus
            textAlignVertical="top"
          />
          <TouchableOpacity style={styles.doneButton} onPress={onStopEditing}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={onEdit}>
          <Text style={styles.paragraphText}>
            {block.content || 'Tap to add paragraph text'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// Content Break Block Component
export const ContentBreakBlockComponent: React.FC<BlockComponentProps & { block: ContentBreakBlock }> = ({
  block,
  isSelected,
  isEditing,
  onUpdate,
  onDelete,
  onDragStart,
  onEdit,
  onStopEditing,
}) => {
  const getBreakStyle = () => {
    switch (block.style) {
      case 'line': return <View style={styles.breakLine} />;
      case 'dots': return <Text style={styles.breakDots}>• • • • •</Text>;
      case 'space': return <View style={styles.breakSpace} />;
      case 'stars': return <Text style={styles.breakStars}>✦ ✦ ✦</Text>;
      default: return <View style={styles.breakLine} />;
    }
  };

  return (
    <View style={[styles.blockContainer, isSelected && styles.selectedBlock]}>
      <View style={styles.blockHeader}>
        <View style={styles.blockInfo}>
          <Text style={styles.blockType}>---</Text>
          <TouchableOpacity style={styles.dragHandle} onPressIn={onDragStart}>
            <Ionicons name="reorder-three" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>
        <View style={styles.blockActions}>
          <TouchableOpacity onPress={onEdit} style={styles.actionButton}>
            <Ionicons name="settings" size={16} color="#60a5fa" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={styles.actionButton}>
            <Ionicons name="trash" size={16} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
      
      {isEditing ? (
        <View style={styles.editingContainer}>
          <Text style={styles.settingLabel}>Break Style:</Text>
          <View style={styles.breakStyleOptions}>
            {['line', 'dots', 'space', 'stars'].map((style) => (
              <TouchableOpacity
                key={style}
                style={[
                  styles.styleOption,
                  block.style === style && styles.selectedStyleOption
                ]}
                onPress={() => onUpdate({ ...block, style: style as any })}
              >
                <Text style={styles.styleOptionText}>{style}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.doneButton} onPress={onStopEditing}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={onEdit} style={styles.breakContainer}>
          {getBreakStyle()}
        </TouchableOpacity>
      )}
    </View>
  );
};

// Image Block Component
export const ImageBlockComponent: React.FC<BlockComponentProps & { block: ImageBlock }> = ({
  block,
  isSelected,
  isEditing,
  onUpdate,
  onDelete,
  onDragStart,
  onEdit,
  onStopEditing,
}) => {
  return (
    <View style={[styles.blockContainer, isSelected && styles.selectedBlock]}>
      <View style={styles.blockHeader}>
        <View style={styles.blockInfo}>
          <Text style={styles.blockType}>📷</Text>
          <TouchableOpacity style={styles.dragHandle} onPressIn={onDragStart}>
            <Ionicons name="reorder-three" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>
        <View style={styles.blockActions}>
          <TouchableOpacity onPress={onEdit} style={styles.actionButton}>
            <Ionicons name="pencil" size={16} color="#60a5fa" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={styles.actionButton}>
            <Ionicons name="trash" size={16} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
      
      {isEditing ? (
        <View style={styles.editingContainer}>
          <TextInput
            style={styles.urlInput}
            value={block.src}
            onChangeText={(src) => onUpdate({ ...block, src })}
            placeholder="Image URL..."
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={styles.textInput}
            value={block.alt}
            onChangeText={(alt) => onUpdate({ ...block, alt })}
            placeholder="Alt text..."
          />
          <TextInput
            style={styles.textInput}
            value={block.caption || ''}
            onChangeText={(caption) => onUpdate({ ...block, caption })}
            placeholder="Caption (optional)..."
          />
          <TouchableOpacity style={styles.doneButton} onPress={onStopEditing}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={onEdit} style={styles.imageContainer}>
          {block.src ? (
            <View>
              <Image 
                source={{ uri: block.src }} 
                style={styles.blockImage}
                resizeMode="cover"
              />
              {block.caption && (
                <Text style={styles.imageCaption}>{block.caption}</Text>
              )}
            </View>
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="image-outline" size={48} color="#9ca3af" />
              <Text style={styles.placeholderText}>Tap to add image</Text>
            </View>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

// Button Block Component
export const ButtonBlockComponent: React.FC<BlockComponentProps & { block: ButtonBlock }> = ({
  block,
  isSelected,
  isEditing,
  onUpdate,
  onDelete,
  onDragStart,
  onEdit,
  onStopEditing,
}) => {
  const handleButtonPress = () => {
    if (block.url && !isEditing) {
      Linking.openURL(block.url);
    }
  };

  const getButtonStyle = () => {
    switch (block.style) {
      case 'primary': return styles.primaryButton;
      case 'secondary': return styles.secondaryButton;
      case 'outline': return styles.outlineButton;
      default: return styles.primaryButton;
    }
  };

  const getButtonTextStyle = () => {
    switch (block.style) {
      case 'primary': return styles.primaryButtonText;
      case 'secondary': return styles.secondaryButtonText;
      case 'outline': return styles.outlineButtonText;
      default: return styles.primaryButtonText;
    }
  };

  return (
    <View style={[styles.blockContainer, isSelected && styles.selectedBlock]}>
      <View style={styles.blockHeader}>
        <View style={styles.blockInfo}>
          <Text style={styles.blockType}>🔗</Text>
          <TouchableOpacity style={styles.dragHandle} onPressIn={onDragStart}>
            <Ionicons name="reorder-three" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>
        <View style={styles.blockActions}>
          <TouchableOpacity onPress={onEdit} style={styles.actionButton}>
            <Ionicons name="pencil" size={16} color="#60a5fa" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={styles.actionButton}>
            <Ionicons name="trash" size={16} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
      
      {isEditing ? (
        <View style={styles.editingContainer}>
          <TextInput
            style={styles.textInput}
            value={block.text}
            onChangeText={(text) => onUpdate({ ...block, text })}
            placeholder="Button text..."
          />
          <TextInput
            style={styles.urlInput}
            value={block.url}
            onChangeText={(url) => onUpdate({ ...block, url })}
            placeholder="Button URL..."
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.settingLabel}>Button Style:</Text>
          <View style={styles.breakStyleOptions}>
            {['primary', 'secondary', 'outline'].map((style) => (
              <TouchableOpacity
                key={style}
                style={[
                  styles.styleOption,
                  block.style === style && styles.selectedStyleOption
                ]}
                onPress={() => onUpdate({ ...block, style: style as any })}
              >
                <Text style={styles.styleOptionText}>{style}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.doneButton} onPress={onStopEditing}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={onEdit} style={styles.buttonWrapper}>
          <TouchableOpacity 
            style={[styles.blockButton, getButtonStyle()]}
            onPress={handleButtonPress}
          >
            <Text style={getButtonTextStyle()}>
              {block.text || 'Button Text'}
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      )}
    </View>
  );
};

// Event List Block Component
export const EventListBlockComponent: React.FC<BlockComponentProps & { block: EventListBlock }> = ({
  block,
  isSelected,
  isEditing,
  onUpdate,
  onDelete,
  onDragStart,
  onEdit,
  onStopEditing,
}) => {
  const [availableEvents, setAvailableEvents] = useState<any[]>([]);
  const [selectedEvents, setSelectedEvents] = useState<string[]>(block.events || []);
  const [showEventPicker, setShowEventPicker] = useState(false);
  const [selectedEventDetails, setSelectedEventDetails] = useState<any[]>([]);

  useEffect(() => {
    // Load available events when editing or when component mounts (for display)
    if (isEditing || selectedEvents.length > 0) {
      loadAvailableEvents();
    }
  }, [isEditing, selectedEvents.length]);

  // Load events on component mount if there are selected events
  useEffect(() => {
    if (selectedEvents.length > 0 && availableEvents.length === 0) {
      loadAvailableEvents();
    }
  }, [selectedEvents.length, availableEvents.length]);

  // Load selected event details for display
  useEffect(() => {
    if (selectedEvents.length > 0 && availableEvents.length > 0) {
      const eventDetails = selectedEvents.map(eventId => 
        availableEvents.find(event => event.id === eventId)
      ).filter(Boolean);
      setSelectedEventDetails(eventDetails);
    } else {
      setSelectedEventDetails([]);
    }
  }, [selectedEvents, availableEvents]);

  const loadAvailableEvents = async () => {
    try {
      const response = await ApiService.getNewsletterEvents();
      setAvailableEvents(response.events || []);
    } catch (error) {
      console.error('Failed to load newsletter events:', error);
      setAvailableEvents([]);
    }
  };

  const toggleEventSelection = (eventId: string) => {
    const newSelection = selectedEvents.includes(eventId)
      ? selectedEvents.filter(id => id !== eventId)
      : [...selectedEvents, eventId];
    
    setSelectedEvents(newSelection);
    onUpdate({ ...block, events: newSelection });
  };

  return (
    <View style={[styles.blockContainer, isSelected && styles.selectedBlock]}>
      <View style={styles.blockHeader}>
        <View style={styles.blockInfo}>
          <Text style={styles.blockType}>📅</Text>
          <TouchableOpacity style={styles.dragHandle} onPressIn={onDragStart}>
            <Ionicons name="reorder-three" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>
        <View style={styles.blockActions}>
          <TouchableOpacity onPress={onEdit} style={styles.actionButton}>
            <Ionicons name="pencil" size={16} color="#60a5fa" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={styles.actionButton}>
            <Ionicons name="trash" size={16} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
      
      {isEditing ? (
        <View style={styles.editingContainer}>
          <TextInput
            style={styles.textInput}
            value={block.title || ''}
            onChangeText={(title) => onUpdate({ ...block, title })}
            placeholder="Events section title..."
          />
          
          <Text style={styles.settingLabel}>Display Options:</Text>
          <View style={styles.checkboxRow}>
            <TouchableOpacity 
              style={styles.checkbox}
              onPress={() => onUpdate({ ...block, showDate: !block.showDate })}
            >
              <Ionicons 
                name={block.showDate ? "checkbox" : "square-outline"} 
                size={20} 
                color="#3b82f6" 
              />
              <Text style={styles.checkboxLabel}>Show Date</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.checkboxRow}>
            <TouchableOpacity 
              style={styles.checkbox}
              onPress={() => onUpdate({ ...block, showLocation: !block.showLocation })}
            >
              <Ionicons 
                name={block.showLocation ? "checkbox" : "square-outline"} 
                size={20} 
                color="#3b82f6" 
              />
              <Text style={styles.checkboxLabel}>Show Location</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.checkboxRow}>
            <TouchableOpacity 
              style={styles.checkbox}
              onPress={() => onUpdate({ ...block, showDescription: !block.showDescription })}
            >
              <Ionicons 
                name={block.showDescription ? "checkbox" : "square-outline"} 
                size={20} 
                color="#3b82f6" 
              />
              <Text style={styles.checkboxLabel}>Show Description</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.settingLabel}>Selected Events: {selectedEvents.length}</Text>
          <TouchableOpacity 
            style={styles.selectEventsButton}
            onPress={() => setShowEventPicker(true)}
          >
            <Text style={styles.selectEventsButtonText}>Select Events</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.doneButton} onPress={onStopEditing}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={onEdit} style={styles.eventsDisplayContainer}>
          <Text style={styles.eventsTitle}>
            {block.title || 'Events'}
          </Text>
          
          {selectedEventDetails.length > 0 ? (
            <View style={styles.eventsListDisplay}>
              {selectedEventDetails.map((event, index) => (
                <View key={event.id} style={styles.eventDisplayItem}>
                  <Text style={styles.eventDisplayTitle}>{event.name}</Text>
                  <View style={styles.eventDisplayDetails}>
                    {(block.showDate !== false) && (
                      <Text style={styles.eventDisplayDate}>
                        📅 {event.displayDate} {event.time && `at ${event.time}`}
                      </Text>
                    )}
                    {(block.showLocation !== false) && event.fullLocation && (
                      <Text style={styles.eventDisplayLocation}>
                        📍 {event.fullLocation}
                      </Text>
                    )}
                    {(block.showDescription !== false) && event.description && (
                      <Text style={styles.eventDisplayDescription} numberOfLines={2}>
                        {event.description}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.placeholderText}>Tap to select events</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Event Picker Modal */}
      <Modal visible={showEventPicker} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Events</Text>
            <TouchableOpacity onPress={() => setShowEventPicker(false)}>
              <Ionicons name="close" size={24} color="#9ca3af" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalScrollView}>
            {availableEvents.length === 0 ? (
              <View style={styles.emptyEventsContainer}>
                <Ionicons name="calendar-outline" size={48} color="#9ca3af" />
                <Text style={styles.emptyEventsText}>No events found</Text>
                <Text style={styles.emptyEventsSubtext}>
                  Join groups and add events to see them here
                </Text>
              </View>
            ) : (
              availableEvents.map((event) => (
                <TouchableOpacity
                  key={event.id}
                  style={[
                    styles.eventItem,
                    selectedEvents.includes(event.id) && styles.selectedEventItem
                  ]}
                  onPress={() => toggleEventSelection(event.id)}
                >
                  <View style={styles.eventItemHeader}>
                    <View style={styles.eventItemInfo}>
                      <Text style={styles.eventItemTitle}>{event.name}</Text>
                      <Text style={styles.eventItemCategory}>🏷️ {event.category || 'General'}</Text>
                    </View>
                    <View style={styles.eventItemActions}>
                      <Ionicons 
                        name={selectedEvents.includes(event.id) ? "checkbox" : "square-outline"} 
                        size={24} 
                        color={selectedEvents.includes(event.id) ? "#10b981" : "#9ca3af"} 
                      />
                    </View>
                  </View>
                  
                  <View style={styles.eventItemDetails}>
                    <Text style={styles.eventItemDate}>
                      📅 {event.displayDate} {event.time && `at ${event.time}`}
                    </Text>
                    {event.fullLocation && (
                      <Text style={styles.eventItemLocation}>
                        📍 {event.fullLocation}
                      </Text>
                    )}
                    {event.description && (
                      <Text style={styles.eventItemDescription} numberOfLines={2}>
                        {event.description}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
          
          <View style={styles.modalFooter}>
            <Text style={styles.selectionSummary}>
              {selectedEvents.length} event(s) selected
            </Text>
            <TouchableOpacity 
              style={styles.modalDoneButton}
              onPress={() => setShowEventPicker(false)}
            >
              <Text style={styles.modalDoneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  blockContainer: {
    marginVertical: 8,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  selectedBlock: {
    borderColor: '#3b82f6',
    borderWidth: 2,
  },
  blockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  blockInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  blockType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    minWidth: 24,
  },
  dragHandle: {
    padding: 4,
  },
  blockActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 4,
  },
  editingContainer: {
    padding: 16,
  },
  headingInput: {
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
    padding: 0,
  },
  headingText: {
    fontWeight: 'bold',
    color: '#1f2937',
    padding: 16,
  },
  paragraphInput: {
    fontSize: 16,
    color: '#1f2937',
    lineHeight: 24,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 12,
    padding: 0,
  },
  paragraphText: {
    fontSize: 16,
    color: '#1f2937',
    lineHeight: 24,
    padding: 16,
  },
  breakContainer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  breakLine: {
    width: '80%',
    height: 1,
    backgroundColor: '#d1d5db',
  },
  breakDots: {
    fontSize: 18,
    color: '#9ca3af',
    letterSpacing: 8,
  },
  breakSpace: {
    height: 40,
  },
  breakStars: {
    fontSize: 16,
    color: '#9ca3af',
    letterSpacing: 12,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  breakStyleOptions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  styleOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
  },
  selectedStyleOption: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  styleOptionText: {
    fontSize: 12,
    color: '#374151',
  },
  imageContainer: {
    padding: 16,
  },
  blockImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  imageCaption: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  imagePlaceholder: {
    height: 150,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
  },
  buttonWrapper: {
    padding: 16,
    alignItems: 'center',
  },
  blockButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
  },
  secondaryButton: {
    backgroundColor: '#6b7280',
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  outlineButtonText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
    color: '#1f2937',
    borderWidth: 1,
    borderColor: '#d1d5db',
    marginBottom: 12,
  },
  urlInput: {
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
    color: '#1f2937',
    borderWidth: 1,
    borderColor: '#d1d5db',
    marginBottom: 12,
    fontFamily: 'monospace',
  },
  doneButton: {
    backgroundColor: '#10b981',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
  doneButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  checkboxRow: {
    marginBottom: 12,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#374151',
  },
  selectEventsButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 12,
  },
  selectEventsButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  eventsDisplayContainer: {
    padding: 16,
  },
  eventsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  eventsCount: {
    fontSize: 14,
    color: '#6b7280',
  },
  eventsListDisplay: {
    marginTop: 12,
    gap: 12,
  },
  eventDisplayItem: {
    backgroundColor: '#f8faff',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  eventDisplayTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 6,
  },
  eventDisplayDetails: {
    gap: 4,
  },
  eventDisplayDate: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  eventDisplayLocation: {
    fontSize: 14,
    color: '#6b7280',
  },
  eventDisplayDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 18,
    marginTop: 2,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  modalContent: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  modalButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 6,
  },
  modalButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalScrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyEventsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyEventsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyEventsSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  eventItem: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  selectedEventItem: {
    backgroundColor: '#ecfdf5',
    borderColor: '#10b981',
  },
  eventItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  eventItemInfo: {
    flex: 1,
    marginRight: 12,
  },
  eventItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  eventItemGroup: {
    fontSize: 12,
    color: '#6b7280',
  },
  eventItemCategory: {
    fontSize: 12,
    color: '#6b7280',
  },
  eventItemActions: {
    alignItems: 'center',
  },
  eventItemDetails: {
    gap: 4,
  },
  eventItemDate: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  eventItemLocation: {
    fontSize: 14,
    color: '#6b7280',
  },
  eventItemDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
    lineHeight: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  selectionSummary: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  modalDoneButton: {
    backgroundColor: '#10b981',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
  },
  modalDoneButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});