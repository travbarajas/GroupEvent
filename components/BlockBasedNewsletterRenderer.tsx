import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
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
  BlockBasedNewsletter,
} from '@/types/blocks';

interface BlockBasedNewsletterRendererProps {
  newsletter: BlockBasedNewsletter;
  isPreview?: boolean;
}

export default function BlockBasedNewsletterRenderer({ 
  newsletter, 
  isPreview = false 
}: BlockBasedNewsletterRendererProps) {
  
  const renderBlock = (block: NewsletterBlock) => {
    switch (block.type) {
      case 'heading-1':
      case 'heading-2':
      case 'heading-3':
      case 'heading-4':
        return renderHeadingBlock(block as HeadingBlock);
      case 'paragraph':
        return renderParagraphBlock(block as ParagraphBlock);
      case 'content-break':
        return renderContentBreakBlock(block as ContentBreakBlock);
      case 'image':
        return renderImageBlock(block as ImageBlock);
      case 'button':
        return renderButtonBlock(block as ButtonBlock);
      default:
        return null;
    }
  };

  const renderHeadingBlock = (block: HeadingBlock) => {
    const getFontSize = () => {
      switch (block.type) {
        case 'heading-1': return 32;
        case 'heading-2': return 28;
        case 'heading-3': return 24;
        case 'heading-4': return 20;
        default: return 24;
      }
    };

    const getTextAlign = () => {
      switch (block.alignment) {
        case 'center': return 'center';
        case 'right': return 'right';
        default: return 'left';
      }
    };

    return (
      <Text 
        key={block.id}
        style={[
          styles.heading,
          { 
            fontSize: getFontSize(),
            textAlign: getTextAlign(),
            marginBottom: block.type === 'heading-1' ? 20 : 16,
          }
        ]}
      >
        {block.content}
      </Text>
    );
  };

  const renderParagraphBlock = (block: ParagraphBlock) => {
    const getTextAlign = () => {
      switch (block.alignment) {
        case 'center': return 'center';
        case 'right': return 'right';
        default: return 'left';
      }
    };

    // Simple markdown-like formatting
    const formatContent = (content: string) => {
      // Split by lines and handle bullet points
      const lines = content.split('\n');
      
      return lines.map((line, index) => {
        if (line.trim().startsWith('•')) {
          return (
            <Text key={index} style={styles.bulletPoint}>
              {line.trim()}
            </Text>
          );
        }
        
        // Handle bold text **text**
        const parts = line.split(/(\*\*.*?\*\*)/g);
        const formattedParts = parts.map((part, partIndex) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <Text key={partIndex} style={styles.boldText}>
                {part.slice(2, -2)}
              </Text>
            );
          }
          return part;
        });
        
        return (
          <Text key={index} style={styles.paragraphLine}>
            {formattedParts}
          </Text>
        );
      });
    };

    return (
      <View key={block.id} style={[styles.paragraphContainer, { alignItems: getTextAlign() as any }]}>
        <Text style={[styles.paragraph, { textAlign: getTextAlign() }]}>
          {formatContent(block.content)}
        </Text>
      </View>
    );
  };

  const renderContentBreakBlock = (block: ContentBreakBlock) => {
    const getBreakElement = () => {
      switch (block.style) {
        case 'dots':
          return (
            <Text style={styles.breakDots}>• • • • •</Text>
          );
        case 'space':
          return <View style={styles.breakSpace} />;
        case 'stars':
          return (
            <Text style={styles.breakStars}>✦ ✦ ✦</Text>
          );
        case 'line':
        default:
          return <View style={styles.breakLine} />;
      }
    };

    return (
      <View key={block.id} style={styles.breakContainer}>
        {getBreakElement()}
      </View>
    );
  };

  const renderImageBlock = (block: ImageBlock) => {
    if (!block.src) return null;

    const getImageAlign = () => {
      switch (block.alignment) {
        case 'left': return 'flex-start';
        case 'right': return 'flex-end';
        case 'center':
        default: return 'center';
      }
    };

    return (
      <View key={block.id} style={[styles.imageContainer, { alignItems: getImageAlign() }]}>
        <Image 
          source={{ uri: block.src }}
          style={[
            styles.blockImage,
            block.width && { width: block.width },
            block.height && { height: block.height },
          ]}
          resizeMode="cover"
          accessibilityLabel={block.alt}
        />
        {block.caption && (
          <Text style={styles.imageCaption}>{block.caption}</Text>
        )}
      </View>
    );
  };

  const renderButtonBlock = (block: ButtonBlock) => {
    if (!block.text || !block.url) return null;

    const handleButtonPress = () => {
      if (block.url) {
        Linking.openURL(block.url);
      }
    };

    const getButtonStyle = () => {
      switch (block.style) {
        case 'secondary':
          return styles.secondaryButton;
        case 'outline':
          return styles.outlineButton;
        case 'primary':
        default:
          return styles.primaryButton;
      }
    };

    const getButtonTextStyle = () => {
      switch (block.style) {
        case 'secondary':
          return styles.secondaryButtonText;
        case 'outline':
          return styles.outlineButtonText;
        case 'primary':
        default:
          return styles.primaryButtonText;
      }
    };

    const getButtonAlign = () => {
      switch (block.alignment) {
        case 'left': return 'flex-start';
        case 'right': return 'flex-end';
        case 'center':
        default: return 'center';
      }
    };

    return (
      <View key={block.id} style={[styles.buttonContainer, { alignItems: getButtonAlign() }]}>
        <TouchableOpacity 
          style={[styles.blockButton, getButtonStyle()]}
          onPress={handleButtonPress}
          activeOpacity={0.8}
        >
          <Text style={getButtonTextStyle()}>
            {block.text}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Parse blocks from JSON if needed
  const blocks = typeof newsletter.blocks === 'string' 
    ? JSON.parse(newsletter.blocks) 
    : newsletter.blocks || [];

  // Sort blocks by order
  const sortedBlocks = blocks.sort((a, b) => a.order - b.order);

  return (
    <View style={styles.container}>
      {/* Newsletter Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{newsletter.title}</Text>
        {newsletter.subtitle && (
          <Text style={styles.subtitle}>{newsletter.subtitle}</Text>
        )}
        <Text style={styles.date}>{newsletter.date}</Text>
        {newsletter.readOnlineUrl && (
          <TouchableOpacity onPress={() => Linking.openURL(newsletter.readOnlineUrl!)}>
            <Text style={styles.readOnline}>Read Online</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Newsletter Content Blocks */}
      <View style={styles.content}>
        {sortedBlocks.map(block => renderBlock(block))}
      </View>

      {/* Events Section (if any) */}
      {newsletter.events && newsletter.events.length > 0 && (
        <View style={styles.eventsSection}>
          <Text style={styles.eventsTitle}>Events</Text>
          {newsletter.events.map((event) => (
            <View key={event.id} style={styles.eventBlock}>
              <Text style={styles.eventDate}>{event.date}</Text>
              <Text style={styles.eventTitle}>{event.title}</Text>
              <Text style={styles.eventDescription}>{event.description}</Text>
              <Text style={styles.eventTime}>
                {event.time} {event.location && `@ ${event.location}`}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Footer */}
      {isPreview && (
        <View style={styles.footer}>
          <Text style={styles.footerText}>Newsletter Preview</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  date: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  readOnline: {
    fontSize: 14,
    color: '#3b82f6',
    textDecorationLine: 'underline',
  },
  content: {
    marginBottom: 24,
  },
  heading: {
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  paragraphContainer: {
    marginBottom: 16,
  },
  paragraph: {
    fontSize: 16,
    color: '#1f2937',
    lineHeight: 24,
  },
  paragraphLine: {
    marginBottom: 4,
  },
  bulletPoint: {
    fontSize: 16,
    color: '#1f2937',
    lineHeight: 24,
    marginLeft: 16,
    marginBottom: 4,
  },
  boldText: {
    fontWeight: 'bold',
  },
  breakContainer: {
    paddingVertical: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  breakLine: {
    width: '60%',
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
  imageContainer: {
    marginBottom: 24,
  },
  blockImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 8,
  },
  imageCaption: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  buttonContainer: {
    marginBottom: 24,
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
    textAlign: 'center',
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  outlineButtonText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  eventsSection: {
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  eventsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  eventBlock: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  eventDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
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
  footer: {
    marginTop: 32,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
});