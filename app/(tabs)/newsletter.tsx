import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useNewsletter } from '@/contexts/NewsletterContext';
import { Newsletter } from '@/types/newsletter';
import NewsletterRenderer from '@/components/NewsletterRenderer';

export default function NewsletterScreen() {
  const router = useRouter();
  const {
    newsletters,
    currentNewsletter,
    setCurrentNewsletter,
    isAdmin,
    loadNewsletters,
  } = useNewsletter();

  const [showPastNewsletters, setShowPastNewsletters] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadNewsletters();
  }, []);

  // Get the latest published newsletter
  const latestNewsletter = newsletters
    .filter(n => n.isPublished)
    .sort((a, b) => new Date(b.publishedAt!).getTime() - new Date(a.publishedAt!).getTime())[0];

  const handleNewsletterPress = (newsletter: Newsletter) => {
    setCurrentNewsletter(newsletter);
    setShowPastNewsletters(false);
  };

  const renderNewsletterContent = (newsletter: Newsletter) => {
    return <NewsletterRenderer newsletter={newsletter} scrollViewRef={scrollViewRef} />;
  };

  const renderPastNewsletterItem = ({ item }: { item: Newsletter }) => (
    <TouchableOpacity
      style={styles.pastNewsletterItem}
      onPress={() => handleNewsletterPress(item)}
    >
      <View style={styles.pastNewsletterHeader}>
        <Text style={styles.pastNewsletterTitle}>{item.title}</Text>
        <Text style={styles.pastNewsletterDate}>
          {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : 'Draft'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Newsletter</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowPastNewsletters(true)}
          >
            <Ionicons name="archive-outline" size={24} color="#60a5fa" />
          </TouchableOpacity>
          {isAdmin && (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => router.push('/newsletter-admin')}
            >
              <Ionicons name="settings-outline" size={24} color="#60a5fa" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Main Content */}
      <ScrollView ref={scrollViewRef} style={styles.content} showsVerticalScrollIndicator={false}>
        {currentNewsletter ? (
          renderNewsletterContent(currentNewsletter)
        ) : latestNewsletter ? (
          renderNewsletterContent(latestNewsletter)
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="newspaper-outline" size={64} color="#6b7280" />
            <Text style={styles.emptyStateTitle}>No Newsletters Yet</Text>
            <Text style={styles.emptyStateText}>
              Check back soon for the latest updates and news!
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Past Newsletters Modal */}
      <Modal
        visible={showPastNewsletters}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Past Newsletters</Text>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowPastNewsletters(false)}
            >
              <Ionicons name="close" size={24} color="#9ca3af" />
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={newsletters.filter(n => n.isPublished)}
            keyExtractor={(item) => item.id}
            renderItem={renderPastNewsletterItem}
            style={styles.pastNewslettersList}
            showsVerticalScrollIndicator={false}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 80,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 22,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#121212',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
  },
  modalCloseButton: {
    padding: 8,
  },
  pastNewslettersList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  pastNewsletterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  pastNewsletterHeader: {
    flex: 1,
  },
  pastNewsletterTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  pastNewsletterDate: {
    fontSize: 14,
    color: '#9ca3af',
  },
});