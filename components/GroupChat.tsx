import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useChat } from '../hooks/useChat';

interface Message {
  id: string;
  message: string;
  username: string;
  device_id: string;
  userColor?: string;
  timestamp: string;
  type?: 'message' | 'typing' | 'user_joined' | 'user_left';
}

interface GroupChatProps {
  groupId: string;
  currentUsername?: string;
}

export default function GroupChat({ groupId, currentUsername }: GroupChatProps) {
  const [newMessage, setNewMessage] = useState('');
  const flatListRef = useRef<FlatList>(null);
  
  // Use the PartyKit chat hook
  const { 
    messages, 
    isConnected, 
    isConnecting, 
    typingUsers, 
    error, 
    sendMessage, 
    sendTyping,
    reconnect 
  } = useChat({
    roomType: 'group',
    roomId: groupId,
    enabled: true,
  });

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Handle message sending
  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    const messageText = newMessage.trim();
    setNewMessage(''); // Clear input immediately
    
    const success = await sendMessage(messageText);
    if (!success) {
      // Restore message on failure
      setNewMessage(messageText);
    }
  };

  // Handle typing indicators
  const handleTextChange = (text: string) => {
    setNewMessage(text);
    
    // Send typing indicator when user starts typing
    if (text.length > 0) {
      sendTyping(true);
    } else {
      sendTyping(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    // Handle system messages differently
    if (item.type === 'user_joined' || item.type === 'user_left') {
      return (
        <View style={styles.systemMessageContainer}>
          <Text style={styles.systemMessageText}>{item.message}</Text>
        </View>
      );
    }

    const isOwnMessage = item.username === currentUsername;
    const userColor = item.userColor || '#60a5fa';

    return (
      <View style={[
        styles.messageContainer,
        isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer
      ]}>
        <View style={[
          styles.messageBubble,
          isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble,
          !isOwnMessage && { borderLeftColor: userColor }
        ]}>
          {!isOwnMessage && (
            <Text style={[styles.username, { color: userColor }]}>
              {item.username || 'Unknown'}
            </Text>
          )}
          <Text style={styles.messageText}>{item.message}</Text>
          <Text style={styles.timestamp}>
            {new Date(item.timestamp).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.chatHeader}>
        <Ionicons name="chatbubbles" size={20} color="#60a5fa" />
        <Text style={styles.chatTitle}>Group Chat</Text>
        <View style={styles.connectionStatus}>
          {isConnecting && (
            <Text style={styles.connectingText}>Connecting...</Text>
          )}
          {isConnected && (
            <View style={styles.connectedIndicator}>
              <View style={styles.connectedDot} />
              <Text style={styles.connectedText}>Connected</Text>
            </View>
          )}
          {error && (
            <TouchableOpacity onPress={reconnect} style={styles.errorContainer}>
              <Text style={styles.errorText}>Reconnect</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        style={styles.messagesList}
        showsVerticalScrollIndicator={false}
      />

      {/* Typing indicators */}
      {typingUsers.length > 0 && (
        <View style={styles.typingContainer}>
          <Text style={styles.typingText}>
            {typingUsers.map(user => user.username).join(', ')} 
            {typingUsers.length === 1 ? ' is' : ' are'} typing...
          </Text>
        </View>
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.messageInput}
          placeholder="Type a message..."
          placeholderTextColor="#6b7280"
          value={newMessage}
          onChangeText={handleTextChange}
          multiline
          maxLength={500}
          editable={isConnected}
        />
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
            size={20} 
            color={(newMessage.trim() && isConnected) ? '#ffffff' : '#6b7280'} 
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    gap: 8,
  },
  chatTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  connectionStatus: {
    marginLeft: 'auto',
  },
  connectingText: {
    color: '#f59e0b',
    fontSize: 12,
  },
  connectedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  connectedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  connectedText: {
    color: '#10b981',
    fontSize: 12,
  },
  errorContainer: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  errorText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  systemMessageText: {
    color: '#9ca3af',
    fontSize: 12,
    fontStyle: 'italic',
  },
  typingContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1a1a1a',
  },
  typingText: {
    color: '#9ca3af',
    fontSize: 12,
    fontStyle: 'italic',
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  messageContainer: {
    marginVertical: 4,
  },
  ownMessageContainer: {
    alignItems: 'flex-end',
  },
  otherMessageContainer: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  ownMessageBubble: {
    backgroundColor: '#60a5fa',
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: '#2a2a2a',
    borderBottomLeftRadius: 4,
    borderLeftWidth: 3,
  },
  username: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  messageText: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 20,
  },
  timestamp: {
    color: '#9ca3af',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'right',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
    alignItems: 'flex-end',
    gap: 12,
  },
  messageInput: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#60a5fa',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#2a2a2a',
  },
});