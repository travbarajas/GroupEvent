import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { ApiService } from '../services/api';
import { DeviceIdManager } from '../utils/deviceId';

interface Message {
  id: string;
  message: string;
  username: string;
  device_id: string;
  userColor?: string;
  timestamp: string;
}

interface GroupChatProps {
  groupId: string;
  currentUsername?: string;
}

export default function GroupChat({ groupId, currentUsername }: GroupChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentDeviceId, setCurrentDeviceId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [lastMessageId, setLastMessageId] = useState<string>('');
  const flatListRef = useRef<FlatList>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    initializeChat();
    return () => {
      // Cleanup polling interval
      mountedRef.current = false;
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [groupId]);

  const initializeChat = async () => {
    try {
      // Get current device ID
      const deviceId = await DeviceIdManager.getDeviceId();
      if (!mountedRef.current) return;
      
      setCurrentDeviceId(deviceId);

      // Fetch initial messages
      await fetchInitialMessages(deviceId);
      
      // Start polling for new messages every 2 seconds
      startPolling(deviceId);
    } catch (error) {
      console.error('Failed to initialize chat:', error);
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const fetchInitialMessages = async (deviceId: string) => {
    try {
      const url = `https://group-event.vercel.app/api/groups/${groupId}/chat?device_id=${deviceId}&limit=50`;
      console.log('Fetching initial messages from:', url);
      
      const response = await fetch(url);
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      
      const responseText = await response.text();
      console.log('Raw response:', responseText);
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        console.log('Response was not JSON:', responseText);
        if (mountedRef.current) {
          setIsLoading(false);
        }
        return;
      }
      
      if (!mountedRef.current) return;

      if (data.messages && data.messages.length > 0) {
        setMessages(data.messages);
        setLastMessageId(data.messages[data.messages.length - 1].id);
        
        // Auto-scroll to bottom
        setTimeout(() => {
          if (mountedRef.current) {
            flatListRef.current?.scrollToEnd({ animated: false });
          }
        }, 100);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to fetch initial messages:', error);
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const pollForNewMessages = useCallback(async (deviceId: string) => {
    if (!mountedRef.current) {
      console.log('Skipping poll - component unmounted');
      return;
    }

    try {
      let url;
      if (lastMessageId) {
        console.log('Polling for messages newer than:', lastMessageId);
        url = `https://group-event.vercel.app/api/groups/${groupId}/chat?device_id=${deviceId}&lastMessageId=${lastMessageId}&limit=20`;
      } else {
        console.log('No lastMessageId, fetching recent messages');
        url = `https://group-event.vercel.app/api/groups/${groupId}/chat?device_id=${deviceId}&limit=20`;
      }

      const response = await fetch(url);
      const data = await response.json();
      
      if (!mountedRef.current) return;

      console.log('Poll response:', data);

      if (data.messages && data.messages.length > 0) {
        console.log('Found', data.messages.length, 'messages');
        
        if (lastMessageId) {
          // Append new messages
          setMessages(prev => [...prev, ...data.messages]);
        } else {
          // Set initial messages if none exist
          setMessages(data.messages);
        }
        
        setLastMessageId(data.messages[data.messages.length - 1].id);
        
        // Auto-scroll to bottom when new messages arrive
        setTimeout(() => {
          if (mountedRef.current) {
            flatListRef.current?.scrollToEnd({ animated: true });
          }
        }, 100);
      } else {
        console.log('No new messages');
      }
    } catch (error) {
      console.error('Failed to poll for new messages:', error);
    }
  }, [groupId, lastMessageId]);

  const startPolling = (deviceId: string) => {
    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    console.log('Starting polling with deviceId:', deviceId);

    // Start polling every 2 seconds
    pollingIntervalRef.current = setInterval(() => {
      if (mountedRef.current) {
        console.log('Polling for new messages...');
        pollForNewMessages(deviceId);
      } else {
        console.log('Component unmounted, stopping poll');
      }
    }, 2000);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !mountedRef.current) return;

    const messageText = newMessage.trim();
    setNewMessage(''); // Clear input immediately for better UX

    try {
      const url = `https://group-event.vercel.app/api/groups/${groupId}/chat`;
      console.log('Sending message to:', url);
      console.log('Message data:', { message: messageText, device_id: currentDeviceId });
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageText,
          device_id: currentDeviceId,
        }),
      });

      console.log('Send message response status:', response.status);
      
      const responseText = await response.text();
      console.log('Send message raw response:', responseText);

      if (response.ok) {
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.error('JSON parse error on send:', parseError);
          if (mountedRef.current) {
            setNewMessage(messageText);
          }
          return;
        }
        
        if (!mountedRef.current) return;

        // Add the sent message to the local state immediately
        if (data.message) {
          setMessages(prev => [...prev, data.message]);
          setLastMessageId(data.message.id);
          
          // Auto-scroll to bottom
          setTimeout(() => {
            if (mountedRef.current) {
              flatListRef.current?.scrollToEnd({ animated: true });
            }
          }, 100);
        }
      } else {
        console.error('Failed to send message, status:', response.status);
        console.error('Error response:', responseText);
        // Restore message on failure
        if (mountedRef.current) {
          setNewMessage(messageText);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Restore message on failure
      if (mountedRef.current) {
        setNewMessage(messageText);
      }
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwnMessage = item.device_id === currentDeviceId;
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
        {isLoading && (
          <Text style={styles.loadingText}>Loading...</Text>
        )}
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        style={styles.messagesList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => {
          if (mountedRef.current) {
            flatListRef.current?.scrollToEnd({ animated: true });
          }
        }}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.messageInput}
          placeholder="Type a message..."
          placeholderTextColor="#6b7280"
          value={newMessage}
          onChangeText={setNewMessage}
          multiline
          maxLength={500}
        />
        <TouchableOpacity 
          style={[
            styles.sendButton,
            !newMessage.trim() && styles.sendButtonDisabled
          ]}
          onPress={sendMessage}
          disabled={!newMessage.trim()}
        >
          <Ionicons 
            name="send" 
            size={20} 
            color={newMessage.trim() ? '#ffffff' : '#6b7280'} 
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
  loadingText: {
    color: '#9ca3af',
    fontSize: 12,
    marginLeft: 8,
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