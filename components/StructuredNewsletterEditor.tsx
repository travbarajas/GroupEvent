import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  
  // State for basic newsletter info
  const [title, setTitle] = useState(newsletter?.title || '');
  const [subtitle, setSubtitle] = useState(newsletter?.subtitle || '');
  const [date, setDate] = useState(newsletter?.date || new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }));

  // Newsletter sections
  const [sections, setSections] = useState<NewsletterSection[]>(() => [
    {
      id: 'highlights',
      title: 'Highlights',
      blocks: []
    },
    {
      id: 'local-news',
      title: 'Local News',
      blocks: []
    },
    {
      id: 'events',
      title: 'Events',
      blocks: []
    },
    {
      id: 'live-music',
      title: 'Live Music',
      blocks: []
    }
  ]);

  // UI state
  const [activeTab, setActiveTab] = useState('highlights');
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [showBlockMenu, setShowBlockMenu] = useState(false);
  const [currentSectionId, setCurrentSectionId] = useState('highlights');

  // Section refs for scrolling
  const sectionRefs = useRef<{[key: string]: View}>({});

  // Load existing newsletter data
  useEffect(() => {
    if (newsletter?.blocks) {
      try {
        const blocks = typeof newsletter.blocks === 'string' 
          ? JSON.parse(newsletter.blocks) 
          : newsletter.blocks;
        
        // Distribute blocks to sections (for now, put all in highlights)
        // TODO: Enhance this to parse section-specific blocks
        setSections(prev => prev.map(section => 
          section.id === 'highlights' 
            ? { ...section, blocks: blocks || [] }
            : section
        ));
      } catch (error) {
        console.error('Error parsing newsletter blocks:', error);
      }
    }
  }, [newsletter]);

  const scrollToSection = (sectionId: string) => {
    setActiveTab(sectionId);
    // TODO: Implement smooth scrolling to section
  };

  const addBlockToCurrentSection = (type: BlockType) => {
    const section = sections.find(s => s.id === currentSectionId);
    if (!section) return;

    // Special handling for Events and Live Music sections
    if ((currentSectionId === 'events' || currentSectionId === 'live-music') && type !== 'event-list') {
      Alert.alert('Note', 'Events and Live Music sections primarily use event blocks. Consider adding an Events block instead.');
      return;
    }

    const newBlock = createBlock(type, section.blocks.length);
    
    // Auto-configure event blocks for Live Music section
    if (type === 'event-list' && currentSectionId === 'live-music') {
      (newBlock as EventListBlock).title = 'Live Music';
    }

    setSections(prev => prev.map(s => 
      s.id === currentSectionId 
        ? { ...s, blocks: [...s.blocks, newBlock] }
        : s
    ));
    
    setEditingBlockId(newBlock.id);
    setShowBlockMenu(false);
  };

  const updateBlockInSection = (sectionId: string, updatedBlock: NewsletterBlock) => {
    setSections(prev => prev.map(section => 
      section.id === sectionId
        ? {
            ...section,
            blocks: section.blocks.map(block => 
              block.id === updatedBlock.id ? updatedBlock : block
            )
          }
        : section
    ));
  };

  const deleteBlockFromSection = (sectionId: string, blockId: string) => {
    Alert.alert(
      'Delete Block',
      'Are you sure you want to delete this block?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            setSections(prev => prev.map(section => 
              section.id === sectionId
                ? {
                    ...section,
                    blocks: section.blocks.filter(block => block.id !== blockId)
                  }
                : section
            ));
            setSelectedBlockId(null);
            setEditingBlockId(null);
          }
        }
      ]
    );
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please provide a newsletter title');
      return;
    }

    try {
      // Combine all blocks from all sections
      const allBlocks = sections.flatMap(section => section.blocks);
      
      // Convert blocks to content for backward compatibility
      const content = allBlocks.map(block => {
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

      const newsletterData = {
        title: title.trim(),
        subtitle: subtitle.trim(),
        date: date.trim(),
        content,
        events: [],
        // Store structured data
        blocks: JSON.stringify(allBlocks),
        sections: JSON.stringify(sections),
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
        <Text style={styles.blockMenuTitle}>Add Block to {sections.find(s => s.id === currentSectionId)?.title}</Text>
        <TouchableOpacity onPress={() => setShowBlockMenu(false)}>
          <Ionicons name="close" size={24} color="#9ca3af" />
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.blockMenuOptions}>
          <TouchableOpacity style={styles.blockOption} onPress={() => addBlockToCurrentSection('heading-1')}>
            <Text style={styles.blockOptionIcon}>H1</Text>
            <Text style={styles.blockOptionText}>Heading 1</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.blockOption} onPress={() => addBlockToCurrentSection('heading-2')}>
            <Text style={styles.blockOptionIcon}>H2</Text>
            <Text style={styles.blockOptionText}>Heading 2</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.blockOption} onPress={() => addBlockToCurrentSection('paragraph')}>
            <Text style={styles.blockOptionIcon}>¶</Text>
            <Text style={styles.blockOptionText}>Paragraph</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.blockOption} onPress={() => addBlockToCurrentSection('event-list')}>
            <Text style={styles.blockOptionIcon}>📅</Text>
            <Text style={styles.blockOptionText}>Events</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.blockOption} onPress={() => addBlockToCurrentSection('content-break')}>
            <Text style={styles.blockOptionIcon}>---</Text>
            <Text style={styles.blockOptionText}>Break</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );

  const renderSection = (section: NewsletterSection) => (
    <View key={section.id} style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => {
            setCurrentSectionId(section.id);
            setShowBlockMenu(true);
          }}
        >
          <Ionicons name="add" size={20} color="#60a5fa" />
          <Text style={styles.addButtonText}>Add Block</Text>
        </TouchableOpacity>
      </View>
      
      {section.blocks.map((block, index) => (
        <DraggableBlock
          key={block.id}
          block={block}
          index={index}
          isSelected={selectedBlockId === block.id}
          isEditing={editingBlockId === block.id}
          isDragging={false}
          dragY={{ value: 0 } as any}
          draggedBlockIndex={{ value: -1 } as any}
          onUpdate={(updatedBlock) => updateBlockInSection(section.id, updatedBlock)}
          onDelete={() => deleteBlockFromSection(section.id, block.id)}
          onDragStart={() => {}}
          onEdit={() => {
            setEditingBlockId(block.id);
            setSelectedBlockId(block.id);
          }}
          onStopEditing={() => setEditingBlockId(null)}
          onSelect={() => setSelectedBlockId(block.id)}
          gestureHandler={() => {}}
        />
      ))}
      
      {section.blocks.length === 0 && (
        <View style={styles.emptySection}>
          <Text style={styles.emptySectionText}>No content yet. Add blocks to get started.</Text>
        </View>
      )}
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

      {/* Tab Navigation */}
      <View style={styles.tabBar}>
        {sections.map((section) => (
          <TouchableOpacity
            key={section.id}
            style={[
              styles.tab,
              activeTab === section.id && styles.activeTab
            ]}
            onPress={() => scrollToSection(section.id)}
          >
            <Text style={[
              styles.tabText,
              activeTab === section.id && styles.activeTabText
            ]}>
              {section.title}
            </Text>
          </TouchableOpacity>
        ))}
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

          {/* Sections */}
          {sections.map(renderSection)}
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
});