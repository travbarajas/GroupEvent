import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRealtimeChat } from '../hooks/useRealtimeChat';
import GroupChat from './GroupChat';

interface ChatPreviewBubbleProps {
  groupId: string;
  groupName: string;
  currentUsername?: string;
}

const { width: screenWidth } = Dimensions.get('window');

export default function ChatPreviewBubble({ 
  groupId, 
  groupName, 
  currentUsername 
}: ChatPreviewBubbleProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showInputField, setShowInputField] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [showConnectionStatus, setShowConnectionStatus] = useState(false);
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Use realtime chat with full functionality
  const { messages, isConnected, isLoading, error, sendMessage } = useRealtimeChat({
    roomType: 'group',
    roomId: groupId,
    enabled: true,
  });

  // Debug connection status
  useEffect(() => {
    // Connection status monitoring removed for production
  }, [isConnected, isLoading, error, messages.length]);

  // Show connection status after 3 seconds delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowConnectionStatus(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  // Show all messages - the height will determine how many are initially visible
  const previewMessages = messages;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const handleChatAreaTap = () => {
    setShowInputField(true);
    setIsExpanded(true); // Expand when input field opens
    
    // Auto-scroll to bottom when input field opens
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleOutsideTap = () => {
    // Always dismiss keyboard if it's open
    Keyboard.dismiss();
    
    // Hide input field if it's showing
    if (showInputField) {
      setShowInputField(false);
    }
  };

  // Handle message sending
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !isConnected) return;

    const messageText = newMessage.trim();
    setNewMessage(''); // Clear input immediately
    
    try {
      const success = await sendMessage(messageText);
      if (!success) {
        // Restore message on failure
        setNewMessage(messageText);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setNewMessage(messageText);
    }
  };

  // Render individual message
  const renderMessage = (message: any) => {
    const isOwnMessage = message.username === currentUsername;
    
    return (
      <View 
        key={message.id}
        style={[
          styles.messageBubble,
          isOwnMessage ? styles.ownMessage : styles.otherMessage
        ]}
      >
        {!isOwnMessage ? (
          <Text style={styles.messageContent}>
            <Text style={styles.messageSender}>{message.username}: </Text>
            {message.message}
          </Text>
        ) : (
          <Text style={styles.messageContent}>{message.message}</Text>
        )}
      </View>
    );
  };

  return (
    <>
      {/* Chat Preview Bar - Under title */}
      <View style={[styles.chatBar, isExpanded && styles.expandedChatBar]}>
        {/* Header */}
        <View style={styles.bubbleHeader}>
            <View style={styles.headerLeft}>
              <Ionicons name="chatbubbles" size={18} color="#60a5fa" />
              <Text style={styles.chatTitle}>Group Chat</Text>
              {!isConnected && showConnectionStatus && (
                <>
                  {isLoading ? (
                    <Text style={styles.statusText}>Connecting...</Text>
                  ) : error ? (
                    <Text style={styles.errorText}>Error</Text>
                  ) : (
                    <Text style={styles.statusText}>Offline</Text>
                  )}
                </>
              )}
            </View>
            <TouchableOpacity style={styles.headerRight} onPress={toggleExpanded}>
              <Ionicons 
                name={isExpanded ? "chevron-up" : "chevron-down"} 
                size={22} 
                color="#9ca3af" 
              />
            </TouchableOpacity>
          </View>

          {/* Chat Content */}
          <View style={styles.expandedContent}>
            {/* Messages List */}
            <ScrollView
              ref={scrollViewRef}
              style={styles.messagesList}
              contentContainerStyle={{ 
                paddingVertical: 8,
                paddingBottom: showInputField ? 20 : 8 // Reduced extra space when input is showing
              }}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
              keyboardShouldPersistTaps="handled"
            >
              <TouchableOpacity 
                onPress={handleChatAreaTap}
                activeOpacity={0.7}
                style={styles.messagesContainer}
              >
                {previewMessages.length > 0 ? (
                  previewMessages.map(renderMessage)
                ) : (
                  <Text style={styles.noMessagesInList}>No messages yet</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
            
            {/* Message Input or Tap to Type */}
            {showInputField ? (
              <TouchableWithoutFeedback>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.messageInput}
                    placeholder="Type a message..."
                    placeholderTextColor="#6b7280"
                    value={newMessage}
                    onChangeText={setNewMessage}
                    maxLength={500}
                    editable={isConnected}
                    autoFocus={true}
                    onBlur={() => setShowInputField(false)}
                    returnKeyType="send"
                    onSubmitEditing={() => {
                      handleSendMessage();
                    }}
                    blurOnSubmit={false}
                    enablesReturnKeyAutomatically={true}
                  />
                  {Platform.OS === 'web' && (
                    <TouchableOpacity 
                      style={[
                        styles.sendButton,
                        (!newMessage.trim() || !isConnected) && styles.sendButtonDisabled
                      ]}
                      onPress={handleSendMessage}
                      disabled={!newMessage.trim() || !isConnected}
                    >
                      <Ionicons 
                        name="send" 
                        size={16} 
                        color={(newMessage.trim() && isConnected) ? '#ffffff' : '#6b7280'} 
                      />
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableWithoutFeedback>
            ) : (
              <TouchableOpacity 
                style={styles.tapToTypeContainer}
                onPress={handleChatAreaTap}
                activeOpacity={0.7}
              >
                <Text style={styles.tapToTypeText}>tap to type</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

      {/* Invisible overlay to catch taps outside chat area when keyboard is up */}
      {showInputField && (
        <TouchableWithoutFeedback onPress={handleOutsideTap}>
          <View style={styles.keyboardOverlay} />
        </TouchableWithoutFeedback>
      )}

    </>
  );
}

const styles = StyleSheet.create({
  chatBar: {
    backgroundColor: '#1a1a1a', // Grey color for whole bar
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    marginHorizontal: -16, // Extend to screen edges, negative margin to counter ScrollView padding
    marginTop: -16, // Remove gap from ScrollView padding at top
    marginBottom: 16, // Space below the bar
    paddingHorizontal: 16, // Add padding back inside
    paddingVertical: 12,
    height: 185, // Tiny bit smaller to view 3 most recent messages
  },
  expandedChatBar: {
    height: 312, // 3px shorter
  },
  bubbleContainer: {
    // Remove container styling since we're using chatBar directly
  },
  bubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  statusText: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '500',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '500',
  },
  expandedContent: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
  },
  messagesContainer: {
    minHeight: '100%',
  },
  tapToTypeContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  tapToTypeText: {
    color: '#6b7280',
    fontSize: 13,
    fontStyle: 'italic',
  },
  noMessagesInList: {
    color: '#6b7280',
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 20,
  },
  messageBubble: {
    marginVertical: 2,
    marginHorizontal: 8,
    padding: 8,
    borderRadius: 10,
    maxWidth: '85%',
  },
  ownMessage: {
    backgroundColor: '#60a5fa',
    alignSelf: 'flex-end',
  },
  otherMessage: {
    backgroundColor: '#2a2a2a',
    alignSelf: 'flex-start',
  },
  messageSender: {
    color: '#60a5fa',
    fontSize: 13,
    fontWeight: '600',
  },
  messageContent: {
    color: '#ffffff',
    fontSize: 13,
    lineHeight: 16,
  },
  messageTimestamp: {
    color: '#9ca3af',
    fontSize: 11,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingTop: 8,
    gap: 8,
  },
  messageInput: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 15,
    maxHeight: 60,
  },
  messageInputFullWidth: {
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 15,
    maxHeight: 60,
  },
  sendButton: {
    backgroundColor: '#60a5fa',
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#2a2a2a',
  },
  keyboardOverlay: {
    position: 'absolute',
    top: -1000, // Extend far above the chat
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1, // Behind the chat but catches taps
  },
});