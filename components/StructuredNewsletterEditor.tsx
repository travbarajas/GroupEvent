import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AdminEventModal from './AdminEventModal';
import { Newsletter } from '@/types/newsletter';
import { 
  NewsletterBlock, 
  BlockType, 
  createBlock,
  EventListBlock,
} from '@/types/blocks';
import DraggableBlock from './blocks/DraggableBlock';
import { useNewsletter } from '@/contexts/NewsletterContext';

interface StructuredNewsletterEditorProps {
  newsletter?: Newsletter;
  onSave: (newsletter: Newsletter) => void;
  onCancel: () => void;
}

interface NewsletterSection {
  id: string;
  title: string;
  blocks: NewsletterBlock[];
}

export default function StructuredNewsletterEditor({ 
  newsletter, 
  onSave, 
  onCancel 
}: StructuredNewsletterEditorProps) {
  const { createNewsletter, updateNewsletter } = useNewsletter();
  const scrollViewRef = useRef<ScrollView>(null);
  const [showAdminModal, setShowAdminModal] = useState(false);
  
  // State for basic newsletter info
  const [title, setTitle] = useState(newsletter?.title || '');
  const [subtitle, setSubtitle] = useState(newsletter?.subtitle || '');
  const [date, setDate] = useState(newsletter?.date || new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }));

  // Newsletter blocks (simplified - no preset sections)
  const [blocks, setBlocks] = useState<NewsletterBlock[]>([]);
  const [showTabBar, setShowTabBar] = useState(true);

  // UI state
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [showBlockMenu, setShowBlockMenu] = useState(false);

  // Section refs for scrolling
  const sectionRefs = useRef<{[key: string]: View}>({});

  // Load existing newsletter data
  useEffect(() => {
    if (newsletter) {
      // Try to load from blocks first
      if (newsletter.blocks) {
        try {
          const existingBlocks = typeof newsletter.blocks === 'string' 
            ? JSON.parse(newsletter.blocks) 
            : newsletter.blocks;
          
          if (Array.isArray(existingBlocks)) {
            const meta = existingBlocks.find((b: any) => b.type === '_meta');
            if (meta) setShowTabBar(meta.showTabBar !== false);
            setBlocks(existingBlocks.filter((b: any) => b.type !== '_meta'));
            return;
          }
        } catch (error) {
          console.error('Error parsing newsletter blocks:', error);
        }
      }
      
      // Try to load from sections (legacy structured format)
      if (newsletter.sections) {
        try {
          const existingSections = typeof newsletter.sections === 'string' 
            ? JSON.parse(newsletter.sections) 
            : newsletter.sections;
          
          if (Array.isArray(existingSections)) {
            // Flatten all blocks from all sections
            const allBlocks = existingSections.flatMap((section: any) => section.blocks || []);
            setBlocks(allBlocks);
            return;
          }
        } catch (error) {
          console.error('Error parsing newsletter sections:', error);
        }
      }
    }
  }, [newsletter]);

  const addBlock = (type: BlockType) => {
    const newBlock = createBlock(type, blocks.length);
    
    // Auto-configure event blocks with default title
    if (type === 'event-list') {
      (newBlock as EventListBlock).title = 'Events';
    }

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
    const performDelete = () => {
      setBlocks(prev => prev.filter(block => block.id !== blockId));
      setSelectedBlockId(null);
      setEditingBlockId(null);
    };

    if (Platform.OS === 'web') {
      // Use window.confirm on web since Alert.alert doesn't work
      if (window.confirm('Are you sure you want to delete this block?')) {
        performDelete();
      }
    } else {
      Alert.alert(
        'Delete Block',
        'Are you sure you want to delete this block?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: performDelete
          }
        ]
      );
    }
  };

  const moveBlockUp = (index: number) => {
    if (index <= 0) return;
    setBlocks(prev => {
      const newBlocks = [...prev];
      [newBlocks[index - 1], newBlocks[index]] = [newBlocks[index], newBlocks[index - 1]];
      return newBlocks;
    });
  };

  const moveBlockDown = (index: number) => {
    setBlocks(prev => {
      if (index >= prev.length - 1) return prev;
      const newBlocks = [...prev];
      [newBlocks[index], newBlocks[index + 1]] = [newBlocks[index + 1], newBlocks[index]];
      return newBlocks;
    });
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please provide a newsletter title');
      return;
    }

    try {
      // Convert blocks to content for backward compatibility
      const content = blocks.map(block => {
        switch (block.type) {
          case 'heading-1':
            return `# ${(block as any).content}`;
          case 'heading-2':
            return `## ${(block as any).content}`;
          case 'heading-3':
            return `### ${(block as any).content}`;
          case 'heading-4':
            return `#### ${(block as any).content}`;
          case 'paragraph':
            return (block as any).content;
          case 'content-break':
            return '---';
          case 'event-list':
            const eventBlock = block as EventListBlock;
            return `<!-- Event List: ${eventBlock.title || 'Events'} - ${eventBlock.events?.length || 0} events -->`;
          default:
            return '';
        }
      }).join('\n\n');

      // Include metadata block for settings like showTabBar
      const blocksWithMeta = [
        { id: '_meta', type: '_meta', order: -1, showTabBar },
        ...blocks,
      ];

      const newsletterData = {
        title: title.trim(),
        subtitle: subtitle.trim(),
        date: date.trim(),
        content,
        events: [],
        // Store blocks data
        blocks: JSON.stringify(blocksWithMeta),
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

  const renderBlockMenu = () => (
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
          <TouchableOpacity style={styles.blockOption} onPress={() => addBlock('paragraph')}>
            <Text style={styles.blockOptionIcon}>¶</Text>
            <Text style={styles.blockOptionText}>Paragraph</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.blockOption} onPress={() => addBlock('event-list')}>
            <Text style={styles.blockOptionIcon}>📅</Text>
            <Text style={styles.blockOptionText}>Events</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.blockOption} onPress={() => addBlock('content-break')}>
            <Text style={styles.blockOptionIcon}>---</Text>
            <Text style={styles.blockOptionText}>Break</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );

  const renderBlock = (block: NewsletterBlock, index: number) => (
    <DraggableBlock
      key={block.id}
      block={block}
      index={index}
      isSelected={selectedBlockId === block.id}
      isEditing={editingBlockId === block.id}
      onUpdate={updateBlock}
      onDelete={() => deleteBlock(block.id)}
      onEdit={() => {
        setEditingBlockId(block.id);
        setSelectedBlockId(block.id);
      }}
      onStopEditing={() => setEditingBlockId(null)}
      onSelect={() => setSelectedBlockId(block.id)}
      onMoveUp={() => moveBlockUp(index)}
      onMoveDown={() => moveBlockDown(index)}
      isFirst={index === 0}
      isLast={index === blocks.length - 1}
    />
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

        <View style={styles.toolbarRight}>
          <TouchableOpacity
            style={styles.createEventButton}
            onPress={() => setShowAdminModal(true)}
          >
            <Ionicons name="add-circle-outline" size={20} color="#60a5fa" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>


      {/* Block Menu */}
      {showBlockMenu && renderBlockMenu()}

      {/* Content */}
      <ScrollView 
        ref={scrollViewRef}
        style={styles.documentContainer} 
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.document}>
          {/* Header Section */}
          <View style={styles.headerSection}>
            <Text style={styles.titleInput}>{title || 'Newsletter Title'}</Text>
            <Text style={styles.subtitleInput}>{subtitle || 'Subtitle'}</Text>
            <Text style={styles.dateText}>{date}</Text>
          </View>

          {/* Settings */}
          <View style={styles.tabBarToggle}>
            <Text style={styles.tabBarToggleLabel}>Show heading tab bar</Text>
            <Switch
              value={showTabBar}
              onValueChange={setShowTabBar}
              trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
              thumbColor={showTabBar ? '#2563eb' : '#f4f3f4'}
            />
          </View>

          {/* Blocks */}
          <View style={styles.blocksSection}>
            {blocks.map((block, index) => renderBlock(block, index))}
            
            {blocks.length === 0 && (
              <View style={styles.emptySection}>
                <Text style={styles.emptySectionText}>No content yet. Add blocks to get started.</Text>
              </View>
            )}
            
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

      <AdminEventModal
        visible={showAdminModal}
        onClose={() => setShowAdminModal(false)}
        onEventCreated={() => setShowAdminModal(false)}
      />
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#2563eb',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeTabText: {
    color: '#2563eb',
    fontWeight: '600',
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
  section: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#60a5fa',
    backgroundColor: '#f8faff',
  },
  addButtonText: {
    fontSize: 14,
    color: '#60a5fa',
    fontWeight: '500',
  },
  emptySection: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptySectionText: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  tabBarToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tabBarToggleLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
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