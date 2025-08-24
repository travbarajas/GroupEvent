import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/useThemeColor';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function GPTChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);

  const backgroundColor = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage = inputText.trim();
    setInputText('');
    
    // Add user message immediately
    const newUserMessage: Message = {
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newUserMessage]);
    setLoading(true);

    try {
      const response = await fetch('https://group-event.vercel.app/api/gpt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          includeEvents: true,
        }),
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);

      // Check if response is OK first
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        
        const errorMessage: Message = {
          role: 'assistant',
          content: `API Error (${response.status}): ${errorText.includes('<!DOCTYPE') ? 'Server returned HTML error page' : errorText}`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
        return;
      }

      // Try to parse JSON
      const responseText = await response.text();
      console.log('Raw response:', responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        console.error('Raw response that failed to parse:', responseText);
        
        const errorMessage: Message = {
          role: 'assistant',
          content: `Failed to parse response. Server returned: ${responseText.substring(0, 200)}...`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
        return;
      }
      
      if (data.success) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        const errorMessage: Message = {
          role: 'assistant',
          content: `Sorry, I encountered an error: ${data.error || 'Unknown error'}. Please try again.`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: `Network error: ${error.message}. Please check your connection and try again.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    Alert.alert(
      'Clear Chat',
      'Are you sure you want to clear all messages?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => setMessages([]) },
      ]
    );
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Ionicons name="sparkles" size={24} color={tintColor} />
          <Text style={[styles.title, { color: textColor }]}>LocalAI</Text>
        </View>
        
        <View style={styles.headerControls}>
          {messages.length > 0 && (
            <TouchableOpacity onPress={clearChat} style={styles.clearButton}>
              <Ionicons name="trash-outline" size={20} color={tintColor} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView 
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
      >
        {messages.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubble-outline" size={64} color="#ccc" />
            <Text style={styles.emptyStateText}>
              Ask LocalAI about events, restaurants, or group planning!
            </Text>
            <Text style={styles.emptyStateSubtext}>
              I have access to all local business events and venues
            </Text>
          </View>
        )}
        
        {messages.map((msg, index) => (
          <View 
            key={index} 
            style={[
              styles.messageBubble,
              msg.role === 'user' ? styles.userMessage : styles.assistantMessage
            ]}
          >
            <Text style={[
              styles.messageText,
              msg.role === 'user' ? styles.userMessageText : { color: '#1a1a1a' }
            ]}>
              {msg.content}
            </Text>
            <Text style={[
              styles.timestamp,
              msg.role === 'user' ? styles.userTimestamp : styles.assistantTimestamp
            ]}>
              {formatTime(msg.timestamp)}
            </Text>
          </View>
        ))}
        
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={tintColor} />
            <Text style={[styles.loadingText, { color: textColor }]}>
              LocalAI is thinking...
            </Text>
          </View>
        )}
      </ScrollView>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inputContainer}
      >
        <View style={[styles.inputRow, { backgroundColor }]}>
          <TextInput
            style={[styles.input, { color: textColor, borderColor: '#e0e0e0' }]}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask me anything..."
            placeholderTextColor="#999"
            multiline
            maxHeight={100}
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity 
            style={[
              styles.sendButton,
              { backgroundColor: tintColor },
              (!inputText.trim() || loading) && styles.sendButtonDisabled
            ]}
            onPress={sendMessage}
            disabled={!inputText.trim() || loading}
          >
            <Ionicons 
              name={loading ? "hourglass-outline" : "send"} 
              size={20} 
              color="white" 
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clearButton: {
    padding: 4,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500',
  },
  messageBubble: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 18,
    marginBottom: 12,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
  },
  userMessageText: {
    color: 'white',
    fontWeight: '500',
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
  },
  userTimestamp: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'right',
  },
  assistantTimestamp: {
    color: '#999',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    fontStyle: 'italic',
    fontWeight: '500',
  },
  inputContainer: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  inputRow: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'flex-end',
    gap: 12,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});