import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Newsletter, NewsletterEvent } from '@/types/newsletter';
import { useGroups } from '@/contexts/GroupsContext';
import { NewsletterBlock, EventListBlock } from '@/types/blocks';
import { ApiService } from '@/services/api';

interface NewsletterRendererProps {
  newsletter: Newsletter;
}

export default function NewsletterRenderer({ newsletter }: NewsletterRendererProps) {
  const { savedEvents, toggleSaveEvent, isEventSaved } = useGroups();
  const [eventDetails, setEventDetails] = useState<any[]>([]);

  // Load event details for event blocks
  useEffect(() => {
    const loadEventDetails = async () => {
      try {
        if (newsletter.blocks) {
          const blocks = typeof newsletter.blocks === 'string' 
            ? JSON.parse(newsletter.blocks) 
            : newsletter.blocks;
          
          // Find all event-list blocks
          const eventBlocks = blocks.filter((block: NewsletterBlock) => block.type === 'event-list');
          if (eventBlocks.length > 0) {
            // Get all unique event IDs
            const allEventIds = eventBlocks.flatMap((block: EventListBlock) => block.events || []);
            
            if (allEventIds.length > 0) {
              // Load event details from the newsletter events API
              const response = await ApiService.getNewsletterEvents();
              const events = response.events.filter(event => allEventIds.includes(event.id));
              setEventDetails(events);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load event details for newsletter:', error);
      }
    };

    loadEventDetails();
  }, [newsletter.blocks]);

  const handleEventPress = (event: NewsletterEvent) => {
    if (event.originalEventId) {
      // Navigate to the expanded event view
      console.log('Navigate to event:', event.originalEventId);
      // In real app: router.push(`/event/${event.originalEventId}`);
    }
  };

  const handleHeartEvent = (event: NewsletterEvent) => {
    if (event.originalEventId) {
      // Create a mock Event object from NewsletterEvent
      const mockEvent = {
        id: event.originalEventId,
        name: event.title,
        date: event.date,
        description: event.description,
        time: event.time,
        price: 'Free', // Default
        distance: event.location,
        type: 'event' as const,
        tags: [],
      };
      toggleSaveEvent(mockEvent);
    }
  };

  const handleShareEvent = async (event: NewsletterEvent) => {
    try {
      const shareContent = {
        message: `Check out this event: ${event.title}\n\n${event.description}\n\nTime: ${event.time}\nLocation: ${event.location}`,
        title: event.title,
      };
      await Share.share(shareContent);
    } catch (error) {
      console.error('Error sharing event:', error);
    }
  };

  const renderEventBlock = (event: NewsletterEvent) => {
    const isEventSavedState = event.originalEventId ? isEventSaved(event.originalEventId) : false;
    
    return (
      <View key={event.id} style={styles.eventBlock}>
        <Text style={styles.eventDate}>{event.date}</Text>
        
        <View style={styles.eventContent}>
          <View style={styles.eventHeader}>
            <TouchableOpacity 
              style={styles.eventTitleContainer}
              onPress={() => handleEventPress(event)}
              disabled={!event.originalEventId}
            >
              <Text style={styles.eventTitle}>{event.title}</Text>
              {event.originalEventId && (
                <Ionicons name="arrow-forward" size={16} color="#60a5fa" />
              )}
            </TouchableOpacity>
            
            <View style={styles.eventActions}>
              {event.originalEventId && (
                <>
                  <TouchableOpacity 
                    style={styles.eventActionButton}
                    onPress={() => handleHeartEvent(event)}
                  >
                    <Ionicons 
                      name={isEventSavedState ? "heart" : "heart-outline"} 
                      size={18} 
                      color={isEventSavedState ? "#ef4444" : "#9ca3af"} 
                    />
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.eventActionButton}
                    onPress={() => handleShareEvent(event)}
                  >
                    <Ionicons name="share-outline" size={18} color="#9ca3af" />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
          
          <Text style={styles.eventDescription}>{event.description}</Text>
          <Text style={styles.eventDetails}>
            {event.time}{event.location ? ` @ ${event.location}` : ''}
          </Text>
        </View>
      </View>
    );
  };
  
  // Render individual block
  const renderBlock = (block: NewsletterBlock, index: number) => {
    switch (block.type) {
      case 'heading-1':
      case 'heading-2':
      case 'heading-3':
      case 'heading-4':
        const HeadingComponent = {
          'heading-1': Text,
          'heading-2': Text,
          'heading-3': Text,
          'heading-4': Text,
        }[block.type];
        const headingStyle = {
          'heading-1': styles.heading1,
          'heading-2': styles.heading2,
          'heading-3': styles.heading3,
          'heading-4': styles.heading4,
        }[block.type];
        return (
          <HeadingComponent key={`block-${index}`} style={headingStyle}>
            {(block as any).content || 'Untitled Heading'}
          </HeadingComponent>
        );

      case 'paragraph':
        return (
          <Text key={`block-${index}`} style={styles.paragraph}>
            {(block as any).content || ''}
          </Text>
        );

      case 'content-break':
        return <View key={`block-${index}`} style={styles.contentBreak} />;

      case 'event-list':
        const eventBlock = block as EventListBlock;
        const blockEvents = eventDetails.filter(event => 
          eventBlock.events?.includes(event.id)
        );
        
        if (blockEvents.length === 0) return null;

        // Group events by date
        const eventsByDate = blockEvents.reduce((groups: any, event: any) => {
          const eventDate = new Date(event.date);
          const dateKey = eventDate.toDateString();
          if (!groups[dateKey]) {
            groups[dateKey] = [];
          }
          groups[dateKey].push(event);
          return groups;
        }, {});

        // Sort dates
        const sortedDates = Object.keys(eventsByDate).sort((a, b) => 
          new Date(a).getTime() - new Date(b).getTime()
        );

        return (
          <View key={`block-${index}`} style={styles.eventListContainer}>
            {eventBlock.title && (
              <Text style={styles.eventListTitle}>{eventBlock.title}</Text>
            )}
            
            {sortedDates.map((dateKey, dateIndex) => {
              const dayEvents = eventsByDate[dateKey];
              const eventDate = new Date(dateKey);
              const dayHeader = eventDate.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'numeric',
                day: 'numeric'
              }).replace(',', ' –');

              return (
                <View key={`day-${dateIndex}`} style={styles.daySection}>
                  <Text style={styles.dayHeader}>{dayHeader}</Text>
                  
                  {dayEvents.map((event: any, eventIndex: number) => (
                    <View key={`event-${eventIndex}`} style={styles.eventItem}>
                      <TouchableOpacity 
                        style={styles.eventTitleButton}
                        onPress={() => {
                          // Handle event press - could navigate to event details
                          console.log('Event pressed:', event.name);
                        }}
                      >
                        <Text style={styles.eventTitleText}>{event.name}</Text>
                      </TouchableOpacity>
                      
                      {(eventBlock.showDescription !== false) && event.description && (
                        <Text style={styles.eventDescription}>
                          {event.description}
                        </Text>
                      )}
                      
                      <View style={styles.eventMetaContainer}>
                        {event.time && (
                          <Text style={styles.eventTime}>{event.time}</Text>
                        )}
                        {(eventBlock.showLocation !== false) && event.fullLocation && (
                          <Text style={styles.eventLocation}>
                            @ {event.fullLocation}
                          </Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        );

      default:
        return null;
    }
  };

  // Render blocks if available, otherwise fall back to content
  const renderBlocksOrContent = () => {
    if (newsletter.blocks) {
      try {
        const blocks = typeof newsletter.blocks === 'string' 
          ? JSON.parse(newsletter.blocks) 
          : newsletter.blocks;
        
        if (Array.isArray(blocks) && blocks.length > 0) {
          return blocks.map((block, index) => renderBlock(block, index));
        }
      } catch (error) {
        console.error('Error parsing newsletter blocks:', error);
      }
    }
    
    // Fallback to content rendering
    return renderContent(newsletter.content);
  };

  const renderContent = (content: string) => {
    if (!content || typeof content !== 'string') return null;

    // Split content into lines for processing
    const lines = content.split('\n');
    const elements: JSX.Element[] = [];

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      if (trimmedLine === '') {
        // Empty line - add spacing
        elements.push(
          <View key={`space-${index}`} style={styles.spacer} />
        );
      } else if (trimmedLine.startsWith('# ')) {
        // H1 Heading
        elements.push(
          <Text key={index} style={styles.heading1}>
            {trimmedLine.substring(2)}
          </Text>
        );
      } else if (trimmedLine.startsWith('## ')) {
        // H2 Heading
        elements.push(
          <Text key={index} style={styles.heading2}>
            {trimmedLine.substring(3)}
          </Text>
        );
      } else if (trimmedLine.startsWith('### ')) {
        // H3 Heading
        elements.push(
          <Text key={index} style={styles.heading3}>
            {trimmedLine.substring(4)}
          </Text>
        );
      } else if (trimmedLine.startsWith('• ')) {
        // Bullet point
        elements.push(
          <Text key={index} style={styles.bulletPoint}>
            {trimmedLine}
          </Text>
        );
      } else {
        // Regular text with potential formatting
        elements.push(
          <Text key={index} style={styles.paragraph}>
            {renderFormattedText(trimmedLine)}
          </Text>
        );
      }
    });

    return elements;
  };

  const renderFormattedText = (text: string) => {
    const elements: (string | JSX.Element)[] = [];
    let currentIndex = 0;
    
    // Handle bold text **text**
    const boldRegex = /\*\*(.*?)\*\*/g;
    let lastIndex = 0;
    let match;
    
    while ((match = boldRegex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        elements.push(text.substring(lastIndex, match.index));
      }
      
      // Add bold text
      elements.push(
        <Text key={`bold-${match.index}`} style={styles.boldText}>
          {match[1]}
        </Text>
      );
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      let remainingText = text.substring(lastIndex);
      
      // Handle italic text *text*
      const italicRegex = /\*(.*?)\*/g;
      let italicLastIndex = 0;
      let italicMatch;
      const italicElements: (string | JSX.Element)[] = [];
      
      while ((italicMatch = italicRegex.exec(remainingText)) !== null) {
        if (italicMatch.index > italicLastIndex) {
          italicElements.push(remainingText.substring(italicLastIndex, italicMatch.index));
        }
        
        italicElements.push(
          <Text key={`italic-${italicMatch.index}`} style={styles.italicText}>
            {italicMatch[1]}
          </Text>
        );
        
        italicLastIndex = italicMatch.index + italicMatch[0].length;
      }
      
      if (italicLastIndex < remainingText.length) {
        let finalText = remainingText.substring(italicLastIndex);
        
        // Handle links [text](url)
        const linkRegex = /\[(.*?)\]\((.*?)\)/g;
        let linkLastIndex = 0;
        let linkMatch;
        const linkElements: (string | JSX.Element)[] = [];
        
        while ((linkMatch = linkRegex.exec(finalText)) !== null) {
          if (linkMatch.index > linkLastIndex) {
            linkElements.push(finalText.substring(linkLastIndex, linkMatch.index));
          }
          
          linkElements.push(
            <TouchableOpacity 
              key={`link-${linkMatch.index}`} 
              onPress={() => Linking.openURL(linkMatch[2])}
            >
              <Text style={styles.linkText}>{linkMatch[1]}</Text>
            </TouchableOpacity>
          );
          
          linkLastIndex = linkMatch.index + linkMatch[0].length;
        }
        
        if (linkLastIndex < finalText.length) {
          linkElements.push(finalText.substring(linkLastIndex));
        }
        
        elements.push(...linkElements);
      } else {
        elements.push(...italicElements);
      }
    }
    
    return elements.length > 0 ? elements : text;
  };

  const handleReadOnlinePress = () => {
    if (newsletter.readOnlineUrl) {
      Linking.openURL(newsletter.readOnlineUrl);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{newsletter.title}</Text>
        {newsletter.subtitle && (
          <Text style={styles.subtitle}>{newsletter.subtitle}</Text>
        )}
        
        <View style={styles.metaRow}>
          <Text style={styles.date}>{newsletter.date}</Text>
          {newsletter.readOnlineUrl && (
            <>
              <Text style={styles.separator}>   |   </Text>
              <TouchableOpacity onPress={handleReadOnlinePress}>
                <Text style={styles.readOnline}>Read Online</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Events Section */}
      {newsletter.events && newsletter.events.length > 0 && (
        <View style={styles.eventsSection}>
          <Text style={styles.eventsSectionTitle}>Events</Text>
          {newsletter.events.map(renderEventBlock)}
        </View>
      )}

      {/* Content */}
      <View style={styles.content}>
        {renderBlocksOrContent()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  date: {
    fontSize: 14,
    color: '#9ca3af',
  },
  separator: {
    fontSize: 14,
    color: '#9ca3af',
  },
  readOnline: {
    fontSize: 14,
    color: '#60a5fa',
    textDecorationLine: 'underline',
  },
  eventsSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  eventsSectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
  },
  eventBlock: {
    marginBottom: 20,
  },
  eventDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  eventContent: {
    marginLeft: 0,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  eventTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 12,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
  },
  eventActions: {
    flexDirection: 'row',
    gap: 8,
  },
  eventActionButton: {
    padding: 4,
  },
  eventDescription: {
    fontSize: 16,
    color: '#e5e7eb',
    lineHeight: 24,
    marginBottom: 4,
  },
  eventDetails: {
    fontSize: 16,
    color: '#e5e7eb',
    lineHeight: 24,
  },
  content: {
    gap: 12,
  },
  heading1: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 16,
    marginBottom: 8,
  },
  heading2: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 12,
    marginBottom: 6,
  },
  heading3: {
    fontSize: 18,
    fontWeight: '500',
    color: '#ffffff',
    marginTop: 8,
    marginBottom: 4,
  },
  paragraph: {
    fontSize: 16,
    color: '#e5e7eb',
    lineHeight: 24,
    marginBottom: 8,
  },
  bulletPoint: {
    fontSize: 16,
    color: '#e5e7eb',
    lineHeight: 24,
    paddingLeft: 16,
    marginBottom: 4,
  },
  boldText: {
    fontWeight: 'bold',
    color: '#ffffff',
  },
  italicText: {
    fontStyle: 'italic',
    color: '#e5e7eb',
  },
  linkText: {
    color: '#60a5fa',
    textDecorationLine: 'underline',
  },
  spacer: {
    height: 8,
  },
  contentBreak: {
    height: 1,
    backgroundColor: '#444',
    marginVertical: 20,
    alignSelf: 'center',
    width: '60%',
  },
  eventListContainer: {
    marginVertical: 16,
  },
  eventListTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
  },
  daySection: {
    marginBottom: 20,
  },
  dayHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  eventItem: {
    marginBottom: 16,
    paddingLeft: 0,
  },
  eventTitleButton: {
    marginBottom: 4,
  },
  eventTitleText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#60a5fa',
    textDecorationLine: 'underline',
  },
  eventDescription: {
    fontSize: 14,
    color: '#e5e7eb',
    lineHeight: 20,
    marginBottom: 4,
  },
  eventMetaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  eventTime: {
    fontSize: 14,
    color: '#d1d5db',
    marginRight: 8,
  },
  eventLocation: {
    fontSize: 14,
    color: '#d1d5db',
  },
  heading3: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
    marginTop: 16,
  },
  heading4: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
    marginBottom: 6,
    marginTop: 12,
  },
});