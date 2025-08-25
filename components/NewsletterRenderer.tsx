import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Share, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Newsletter, NewsletterEvent } from '@/types/newsletter';
import { useGroups } from '@/contexts/GroupsContext';
import { NewsletterBlock, EventListBlock } from '@/types/blocks';
import { ApiService } from '@/services/api';

interface NewsletterRendererProps {
  newsletter: Newsletter;
  scrollViewRef?: React.RefObject<ScrollView | null>;
}

export default function NewsletterRenderer({ newsletter, scrollViewRef: externalScrollViewRef }: NewsletterRendererProps) {
  const router = useRouter();
  const { savedEvents, toggleSaveEvent, isEventSaved } = useGroups();
  const [eventDetails, setEventDetails] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('');
  const internalScrollViewRef = useRef<ScrollView>(null);
  const scrollViewRef = externalScrollViewRef || internalScrollViewRef;
  const [eventListPositions, setEventListPositions] = useState<{[key: string]: number}>({});

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

  // Get event list blocks and their titles for dynamic tab creation
  const getEventListTabs = () => {
    const tabs = [];
    
    if (newsletter.blocks) {
      try {
        const blocks = typeof newsletter.blocks === 'string' 
          ? JSON.parse(newsletter.blocks) 
          : newsletter.blocks;
        
        // Find all event-list blocks and create tabs from their titles
        blocks.forEach((block: any) => {
          if (block.type === 'event-list' && block.title) {
            tabs.push({
              id: block.id,
              title: block.title,
              blockId: block.id
            });
          }
        });
      } catch (error) {
        console.error('Error parsing newsletter blocks:', error);
      }
    }
    
    // If structured sections exist, also check those for event lists
    if (newsletter.sections) {
      try {
        const sections = typeof newsletter.sections === 'string' 
          ? JSON.parse(newsletter.sections) 
          : newsletter.sections;
        
        sections.forEach((section: any) => {
          if (section.blocks) {
            section.blocks.forEach((block: any) => {
              if (block.type === 'event-list' && block.title) {
                tabs.push({
                  id: block.id,
                  title: block.title,
                  blockId: block.id
                });
              }
            });
          }
        });
      } catch (error) {
        console.error('Error parsing newsletter sections:', error);
      }
    }
    
    return tabs;
  };

  const eventListTabs = getEventListTabs();
  const hasEventListTabs = eventListTabs.length > 0;

  const scrollToEventList = (blockId: string) => {
    setActiveTab(blockId);
    
    if (scrollViewRef.current) {
      console.log(`🎯 Attempting to scroll to blockId: ${blockId}`);
      console.log(`🎯 Available tabs:`, eventListTabs.map(t => ({ id: t.blockId, title: t.title })));
      console.log(`🎯 Stored positions:`, eventListPositions);
      
      // First check if we have a stored position for this block
      if (eventListPositions[blockId]) {
        // Position the section title in the upper portion of the screen
        // Smaller offset to prevent over-scrolling
        const screenOffset = -200; // Small offset to position title in upper area
        const exactPosition = Math.max(0, eventListPositions[blockId] - screenOffset);
        
        console.log(`🎯 Original position: ${eventListPositions[blockId]}, Adjusted position: ${exactPosition}`);
        
        scrollViewRef.current.scrollTo({ y: exactPosition, animated: true });
        return;
      }
      
      // Find the index of this event list in all event lists
      const eventListIndex = eventListTabs.findIndex(tab => tab.blockId === blockId);
      console.log(`🎯 Found event list at index: ${eventListIndex}`);
      
      if (eventListIndex >= 0) {
        // Use a more aggressive scroll estimate, positioning title in upper area
        const headerHeight = 200; // Newsletter header
        const tabHeight = 50; // Tab bar
        const averageBlockHeight = 400; // Average height per block/event list
        const screenOffset = -200; // Sweet spot offset for positioning
        
        const estimatedPosition = headerHeight + tabHeight + (eventListIndex * averageBlockHeight);
        const adjustedScrollY = Math.max(0, estimatedPosition - screenOffset);
        
        console.log(`🎯 Estimated position: ${estimatedPosition}, Adjusted for upper half: ${adjustedScrollY}`);
        
        scrollViewRef.current.scrollTo({ y: adjustedScrollY, animated: true });
      } else {
        console.log(`🚫 Event list ${blockId} not found in tabs`);
      }
    } else {
      console.log(`🚫 ScrollView ref is null`);
    }
  };

  // Handle event press to navigate to event detail page
  const handleNewsletterEventPress = (event: any) => {
    // Convert newsletter event to the format expected by event detail page
    const eventForDetail = {
      id: event.id,
      name: event.name,
      description: event.description,
      date: event.displayDate || event.date,
      time: event.time || '',
      price: event.isFree ? 'Free' : (event.price ? `$${event.price}` : 'TBD'),
      distance: event.fullLocation || event.location || '',
      type: event.category || 'general',
      tags: event.tags || []
    };
    
    router.push({
      pathname: '/event-detail',
      params: { event: JSON.stringify(eventForDetail) }
    });
  };

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
        
        console.log(`📋 Event Block: ${eventBlock.title}, Events: ${eventBlock.events?.length || 0}, BlockEvents: ${blockEvents.length}`);
        
        // Always show the event list container, even if no events
        if (!eventBlock.events || eventBlock.events.length === 0) {
          return (
            <View key={`block-${index}`} style={styles.eventListContainer}>
              {eventBlock.title && (
                <Text style={styles.eventListTitle}>{eventBlock.title}</Text>
              )}
              <Text style={styles.emptySectionText}>No events selected for this section.</Text>
            </View>
          );
        }
        
        if (blockEvents.length === 0) {
          return (
            <View key={`block-${index}`} style={styles.eventListContainer}>
              {eventBlock.title && (
                <Text style={styles.eventListTitle}>{eventBlock.title}</Text>
              )}
              <Text style={styles.emptySectionText}>Events are loading...</Text>
            </View>
          );
        }

        // Group events by date (using date string to avoid timezone issues)
        const eventsByDate = blockEvents.reduce((groups: any, event: any) => {
          // Handle both ISO datetime strings and simple date strings
          let dateKey = event.date;
          if (typeof dateKey === 'string' && dateKey.includes('T')) {
            // Extract just the date part from ISO datetime string
            dateKey = dateKey.split('T')[0];
          }
          console.log(`📅 Event: ${event.name}, Date: ${event.date}, DateKey: ${dateKey}`);
          if (!groups[dateKey]) {
            groups[dateKey] = [];
          }
          groups[dateKey].push(event);
          return groups;
        }, {});

        // Sort dates (compare date strings directly)
        const sortedDates = Object.keys(eventsByDate).sort((a, b) => 
          a.localeCompare(b) // YYYY-MM-DD strings sort correctly lexicographically
        );

        console.log(`📋 Rendering event list: ${eventBlock.title}, ID: ${eventBlock.id}`);
        
        return (
          <View 
            key={`block-${index}`} 
            style={styles.eventListContainer}
            onLayout={(event) => {
              const { y } = event.nativeEvent.layout;
              setEventListPositions(prev => ({
                ...prev,
                [eventBlock.id]: y
              }));
              console.log(`📐 Event list "${eventBlock.title}" (${eventBlock.id}) positioned at Y: ${y}`);
            }}
          >
            {eventBlock.title && (
              <Text style={[styles.eventListTitle, styles.eventListH1]}>{eventBlock.title}</Text>
            )}
            
            {sortedDates.map((dateKey, dateIndex) => {
              const dayEvents = eventsByDate[dateKey];
              // Parse date string as local date to avoid timezone shifts
              const [year, month, day] = dateKey.split('-').map(Number);
              const eventDate = new Date(year, month - 1, day); // month is 0-indexed
              const dayHeader = eventDate.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'numeric',
                day: 'numeric'
              }).replace(',', ' –');
              console.log(`📅 DateKey: ${dateKey}, Parsed: ${year}-${month}-${day}, EventDate: ${eventDate.toDateString()}, DayHeader: ${dayHeader}`);

              return (
                <View key={`day-${dateIndex}`} style={styles.daySection}>
                  <Text style={styles.dayHeader}>{dayHeader}</Text>
                  
                  {dayEvents.map((event: any, eventIndex: number) => (
                    <TouchableOpacity 
                      key={`event-${eventIndex}`} 
                      style={styles.eventItem}
                      onPress={() => handleNewsletterEventPress(event)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.eventTitleText}>{event.name}</Text>
                      
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
                    </TouchableOpacity>
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

  // Render blocks or content - simplified approach
  const renderBlocksOrContent = () => {
    // First try to render from blocks (new format)
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
    
    // Try structured sections format
    if (newsletter.sections) {
      try {
        const sections = typeof newsletter.sections === 'string' 
          ? JSON.parse(newsletter.sections) 
          : newsletter.sections;
        
        return sections.flatMap((section: any) => 
          section.blocks ? section.blocks.map((block: any, index: number) => renderBlock(block, index)) : []
        );
      } catch (error) {
        console.error('Error parsing newsletter sections:', error);
      }
    }
    
    // Fallback to content rendering (legacy format)
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
      } else if (trimmedLine.startsWith('<!--') && trimmedLine.endsWith('-->')) {
        // Skip HTML comments (like Event List comments)
        return;
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

      {/* Tab Navigation for Event Lists */}
      {hasEventListTabs && (
        <View style={styles.tabBar}>
          {eventListTabs.map((tab: any) => (
            <TouchableOpacity
              key={tab.blockId}
              style={[
                styles.tab,
                activeTab === tab.blockId && styles.activeTab
              ]}
              onPress={() => scrollToEventList(tab.blockId)}
            >
              <Text style={[
                styles.tabText,
                activeTab === tab.blockId && styles.activeTabText
              ]}>
                {tab.title}
              </Text>
            </TouchableOpacity>
          ))}
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
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 20,
  },
  eventListH1: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 24,
    marginBottom: 20,
    textAlign: 'left',
  },
  daySection: {
    marginBottom: 20,
  },
  dayHeader: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  eventItem: {
    marginBottom: 16,
    paddingLeft: 0,
  },
  eventTitleText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#60a5fa',
    marginBottom: 6,
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#121212',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    marginTop: -4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#60a5fa',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9ca3af',
  },
  activeTabText: {
    color: '#60a5fa',
    fontWeight: '600',
  },
  structuredSection: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  structuredSectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 20,
  },
  emptySectionText: {
    fontSize: 16,
    color: '#6b7280',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
});