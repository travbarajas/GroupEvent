import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  SafeAreaView,
} from 'react-native';
import {
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
  State,
} from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  runOnJS,
  withSpring,
} from 'react-native-reanimated';
import { Newsletter, NewsletterEvent } from '@/types/newsletter';
import { 
  NewsletterBlock, 
  BlockType, 
  createBlock, 
  reorderBlocks,
  HeadingBlock,
  ParagraphBlock,
  ContentBreakBlock,
  ImageBlock,
  ButtonBlock,
} from '@/types/blocks';
import DraggableBlock from './blocks/DraggableBlock';
import { useNewsletter } from '@/contexts/NewsletterContext';

interface BlockBasedNewsletterEditorProps {
  newsletter?: Newsletter;
  onSave: (newsletter: Newsletter) => void;
  onCancel: () => void;
}

export default function BlockBasedNewsletterEditor({ 
  newsletter, 
  onSave, 
  onCancel 
}: BlockBasedNewsletterEditorProps) {
  const { createNewsletter, updateNewsletter } = useNewsletter();
  
  // Convert existing newsletter content to blocks if needed (memoized)
  const initialBlocks = useMemo((): NewsletterBlock[] => {
    if (newsletter?.content) {
      // Simple conversion from existing content to paragraph blocks
      const paragraphs = newsletter.content.split('\n\n').filter(p => p.trim());
      return paragraphs.map((paragraph, index) => {
        if (paragraph.startsWith('# ')) {
          const block = createBlock('heading-1', index) as HeadingBlock;
          return { ...block, content: paragraph.substring(2) };
        } else if (paragraph.startsWith('## ')) {
          const block = createBlock('heading-2', index) as HeadingBlock;
          return { ...block, content: paragraph.substring(3) };
        } else if (paragraph.startsWith('### ')) {
          const block = createBlock('heading-3', index) as HeadingBlock;
          return { ...block, content: paragraph.substring(4) };
        } else {
          const block = createBlock('paragraph', index) as ParagraphBlock;
          return { ...block, content: paragraph };
        }
      });
    }
    return [];
  }, [newsletter?.content]);

  // State
  const [title, setTitle] = useState(newsletter?.title || '');
  const [subtitle, setSubtitle] = useState(newsletter?.subtitle || '');
  const [date, setDate] = useState(newsletter?.date || new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }));
  const [readOnlineUrl, setReadOnlineUrl] = useState(newsletter?.readOnlineUrl || '');
  const [blocks, setBlocks] = useState<NewsletterBlock[]>(initialBlocks);
  const [events, setEvents] = useState<NewsletterEvent[]>(newsletter?.events || []);
  
  // UI state
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [showBlockMenu, setShowBlockMenu] = useState(false);
  
  // Drag and drop
  const dragY = useSharedValue(0);
  const draggedBlockIndex = useSharedValue(-1);
  const [isDragging, setIsDragging] = useState(false);

  // Update blocks when newsletter changes
  useEffect(() => {
    setBlocks(initialBlocks);
  }, [initialBlocks]);

  const addBlock = (type: BlockType) => {
    const newBlock = createBlock(type, blocks.length);
    setBlocks(prev => [...prev, newBlock]);
    setEditingBlockId(newBlock.id);
    setShowBlockMenu(false);
  };

  const updateBlock = (updatedBlock: NewsletterBlock) => {
    setBlocks(prev => prev.map(block => 
      block.id === updatedBlock.id ? updatedBlock : block
    ));
  };

  const deleteBlock = (blockId: string) => {
    Alert.alert(
      'Delete Block',
      'Are you sure you want to delete this block?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            setBlocks(prev => prev.filter(block => block.id !== blockId));
            setSelectedBlockId(null);
            setEditingBlockId(null);
          }
        }
      ]
    );
  };

  const moveBlock = (fromIndex: number, toIndex: number) => {
    setBlocks(prev => reorderBlocks(prev, fromIndex, toIndex));
  };

  const handleDragStart = (blockId: string) => {
    const index = blocks.findIndex(b => b.id === blockId);
    draggedBlockIndex.value = index;
    setIsDragging(true);
  };

  const gestureHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent>({
    onStart: () => {
      dragY.value = 0;
    },
    onActive: (event) => {
      dragY.value = event.translationY;
    },
    onEnd: () => {
      const currentIndex = draggedBlockIndex.value;
      const newIndex = Math.max(0, Math.min(blocks.length - 1, 
        Math.round(currentIndex + dragY.value / 80)
      ));
      
      if (currentIndex !== newIndex && currentIndex >= 0) {
        runOnJS(moveBlock)(currentIndex, newIndex);
      }
      
      dragY.value = withSpring(0);
      draggedBlockIndex.value = -1;
      runOnJS(setIsDragging)(false);
    },
  });

  const renderBlock = (block: NewsletterBlock, index: number) => {
    const isSelected = selectedBlockId === block.id;
    const isEditing = editingBlockId === block.id;

    return (
      <DraggableBlock
        key={block.id}
        block={block}
        index={index}
        isSelected={isSelected}
        isEditing={isEditing}
        isDragging={isDragging}
        dragY={dragY}
        draggedBlockIndex={draggedBlockIndex}
        onUpdate={updateBlock}
        onDelete={() => deleteBlock(block.id)}
        onDragStart={() => handleDragStart(block.id)}
        onEdit={() => {
          setEditingBlockId(block.id);
          setSelectedBlockId(block.id);
        }}
        onStopEditing={() => setEditingBlockId(null)}
        onSelect={() => setSelectedBlockId(block.id)}
        gestureHandler={gestureHandler}
      />
    );
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please provide a newsletter title');
      return;
    }

    try {
      // Convert blocks back to content string for API compatibility
      const content = blocks.map(block => {
        switch (block.type) {
          case 'heading-1':
            return `# ${(block as HeadingBlock).content}`;
          case 'heading-2':
            return `## ${(block as HeadingBlock).content}`;
          case 'heading-3':
            return `### ${(block as HeadingBlock).content}`;
          case 'heading-4':
            return `#### ${(block as HeadingBlock).content}`;
          case 'paragraph':
            return (block as ParagraphBlock).content;
          case 'content-break':
            return '---';
          case 'image':
            const imgBlock = block as ImageBlock;
            return `![${imgBlock.alt}](${imgBlock.src})${imgBlock.caption ? `\n*${imgBlock.caption}*` : ''}`;
          case 'button':
            const btnBlock = block as ButtonBlock;
            return `[${btnBlock.text}](${btnBlock.url})`;
          default:
            return '';
        }
      }).join('\n\n');

      const newsletterData = {
        title: title.trim(),
        subtitle: subtitle.trim(),
        date: date.trim(),
        readOnlineUrl: readOnlineUrl.trim(),
        content,
        events,
        // Store blocks in a custom field (you can add this to your API)
        blocks: JSON.stringify(blocks),
      };

      if (newsletter) {
        await updateNewsletter(newsletter.id, newsletterData);
        onSave({ ...newsletter, ...newsletterData });
      } else {
        const newNewsletter = await createNewsletter(title.trim());
        await updateNewsletter(newNewsletter.id, newsletterData);
        onSave({ ...newNewsletter, ...newsletterData });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save newsletter');
    }
  };

  const BlockMenu = () => (
    <View style={styles.blockMenu}>
      <View style={styles.blockMenuHeader}>
        <Text style={styles.blockMenuTitle}>Add Block</Text>
        <TouchableOpacity onPress={() => setShowBlockMenu(false)}>
          <Ionicons name="close" size={24} color="#9ca3af" />
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.blockMenuOptions}>
          <TouchableOpacity style={styles.blockOption} onPress={() => addBlock('heading-1')}>
            <Text style={styles.blockOptionIcon}>H1</Text>
            <Text style={styles.blockOptionText}>Heading 1</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.blockOption} onPress={() => addBlock('heading-2')}>
            <Text style={styles.blockOptionIcon}>H2</Text>
            <Text style={styles.blockOptionText}>Heading 2</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.blockOption} onPress={() => addBlock('heading-3')}>
            <Text style={styles.blockOptionIcon}>H3</Text>
            <Text style={styles.blockOptionText}>Heading 3</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.blockOption} onPress={() => addBlock('heading-4')}>
            <Text style={styles.blockOptionIcon}>H4</Text>
            <Text style={styles.blockOptionText}>Heading 4</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.blockOption} onPress={() => addBlock('paragraph')}>
            <Text style={styles.blockOptionIcon}>¶</Text>
            <Text style={styles.blockOptionText}>Paragraph</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.blockOption} onPress={() => addBlock('content-break')}>
            <Text style={styles.blockOptionIcon}>---</Text>
            <Text style={styles.blockOptionText}>Break</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.blockOption} onPress={() => addBlock('image')}>
            <Text style={styles.blockOptionIcon}>📷</Text>
            <Text style={styles.blockOptionText}>Image</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.blockOption} onPress={() => addBlock('button')}>
            <Text style={styles.blockOptionIcon}>🔗</Text>
            <Text style={styles.blockOptionText}>Button</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );

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
        
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>

      {/* Block Menu */}
      {showBlockMenu && <BlockMenu />}

      {/* Document Content */}
      <ScrollView style={styles.documentContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.document}>
          {/* Header Section - Same as before but simplified */}
          <View style={styles.headerSection}>
            <Text style={styles.titleInput}>{title || 'Newsletter Title'}</Text>
            <Text style={styles.subtitleInput}>{subtitle || 'Subtitle'}</Text>
            <Text style={styles.dateText}>{date}</Text>
          </View>

          {/* Blocks Section */}
          <View style={styles.blocksSection}>
            {blocks.map((block, index) => renderBlock(block, index))}
            
            {/* Add Block Button */}
            <TouchableOpacity 
              style={styles.addBlockButton} 
              onPress={() => setShowBlockMenu(true)}
            >
              <Ionicons name="add" size={24} color="#60a5fa" />
              <Text style={styles.addBlockButtonText}>Add Block</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
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
  blockMenu: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 12,
  },
  blockMenuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  blockMenuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  blockMenuOptions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  blockOption: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    minWidth: 80,
  },
  blockOptionIcon: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  blockOptionText: {
    fontSize: 12,
    color: '#6b7280',
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
  dateText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  blocksSection: {
    padding: 16,
  },
  addBlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 20,
    marginTop: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#60a5fa',
    borderStyle: 'dashed',
    backgroundColor: '#f8faff',
  },
  addBlockButtonText: {
    fontSize: 16,
    color: '#60a5fa',
    fontWeight: '500',
  },
});