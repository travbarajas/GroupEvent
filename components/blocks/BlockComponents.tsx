import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  Image,
  Linking,
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
});