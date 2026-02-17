import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiService } from '@/services/api';

interface AnalyticsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function AnalyticsModal({ visible, onClose }: AnalyticsModalProps) {
  const insets = useSafeAreaInsets();
  const [analytics, setAnalytics] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (visible) {
      loadAnalytics();
    }
  }, [visible]);

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const data = await ApiService.getAnalytics();
      setAnalytics(data.analytics || {});
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAnalytics();
    setRefreshing(false);
  };

  // Calculate overview totals
  const pageStats = analytics.page || {};
  const newsletterStats = analytics.newsletter || {};
  const eventStats = analytics.event || {};

  // Unique devices across all page views
  const totalUniqueDevices = Object.values(pageStats).reduce(
    (sum: number, s: any) => sum + (s.page_view?.unique || 0), 0
  );
  const totalNewsletterReaders = Object.values(newsletterStats).reduce(
    (sum: number, s: any) => sum + (s.page_view?.unique || 0), 0
  );
  const totalEventClicks = Object.values(eventStats).reduce(
    (sum: number, s: any) => sum + (s.page_view?.total || 0), 0
  );
  const totalEventSaves = Object.values(eventStats).reduce(
    (sum: number, s: any) => sum + (s.save?.total || 0), 0
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerSideButton}>
            <Ionicons name="close" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Analytics</Text>
          <View style={styles.headerSideButton} />
        </View>

        {isLoading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#60a5fa" />
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#60a5fa" />
            }
          >
            {/* Overview */}
            <Text style={styles.sectionTitle}>Overview</Text>
            <View style={styles.overviewGrid}>
              <View style={styles.overviewCard}>
                <Ionicons name="people-outline" size={20} color="#60a5fa" />
                <Text style={styles.overviewNumber}>{totalUniqueDevices}</Text>
                <Text style={styles.overviewLabel}>App Visits</Text>
              </View>
              <View style={styles.overviewCard}>
                <Ionicons name="newspaper-outline" size={20} color="#f59e0b" />
                <Text style={styles.overviewNumber}>{totalNewsletterReaders}</Text>
                <Text style={styles.overviewLabel}>Newsletter Readers</Text>
              </View>
              <View style={styles.overviewCard}>
                <Ionicons name="calendar-outline" size={20} color="#10b981" />
                <Text style={styles.overviewNumber}>{totalEventClicks}</Text>
                <Text style={styles.overviewLabel}>Event Clicks</Text>
              </View>
              <View style={styles.overviewCard}>
                <Ionicons name="heart-outline" size={20} color="#ef4444" />
                <Text style={styles.overviewNumber}>{totalEventSaves}</Text>
                <Text style={styles.overviewLabel}>Event Saves</Text>
              </View>
            </View>

            {/* Newsletters */}
            {Object.keys(newsletterStats).length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Newsletters</Text>
                {Object.entries(newsletterStats)
                  .sort((a: any, b: any) => (b[1].page_view?.total || 0) - (a[1].page_view?.total || 0))
                  .map(([id, stats]: [string, any]) => (
                    <View key={id} style={styles.itemCard}>
                      <Text style={styles.itemName} numberOfLines={1}>{stats._name || id}</Text>
                      <View style={styles.itemMetrics}>
                        <View style={styles.metric}>
                          <Ionicons name="eye-outline" size={14} color="#60a5fa" />
                          <Text style={styles.metricValue}>{stats.page_view?.total || 0}</Text>
                          <Text style={styles.metricLabel}>views</Text>
                        </View>
                        <View style={styles.metric}>
                          <Ionicons name="person-outline" size={14} color="#a78bfa" />
                          <Text style={styles.metricValue}>{stats.page_view?.unique || 0}</Text>
                          <Text style={styles.metricLabel}>unique</Text>
                        </View>
                      </View>
                    </View>
                  ))}
              </>
            )}

            {/* Events */}
            {Object.keys(eventStats).length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Events</Text>
                {Object.entries(eventStats)
                  .sort((a: any, b: any) => (b[1].page_view?.total || 0) - (a[1].page_view?.total || 0))
                  .map(([id, stats]: [string, any]) => (
                    <View key={id} style={styles.itemCard}>
                      <Text style={styles.itemName} numberOfLines={1}>{stats._name || id}</Text>
                      <View style={styles.itemMetrics}>
                        <View style={styles.metric}>
                          <Ionicons name="eye-outline" size={14} color="#60a5fa" />
                          <Text style={styles.metricValue}>{stats.page_view?.total || 0}</Text>
                          <Text style={styles.metricLabel}>views</Text>
                        </View>
                        <View style={styles.metric}>
                          <Ionicons name="person-outline" size={14} color="#a78bfa" />
                          <Text style={styles.metricValue}>{stats.page_view?.unique || 0}</Text>
                          <Text style={styles.metricLabel}>unique</Text>
                        </View>
                        {stats.save && (
                          <View style={styles.metric}>
                            <Ionicons name="heart" size={14} color="#ef4444" />
                            <Text style={styles.metricValue}>{stats.save.total}</Text>
                            <Text style={styles.metricLabel}>saves</Text>
                          </View>
                        )}
                      </View>
                      {/* Source breakdown */}
                      {stats._sources && Object.keys(stats._sources).length > 0 && (
                        <View style={styles.sourcesRow}>
                          <Text style={styles.sourcesLabel}>From:</Text>
                          {Object.entries(stats._sources)
                            .sort((a: any, b: any) => b[1].total - a[1].total)
                            .map(([source, sourceStats]: [string, any]) => (
                              <View key={source} style={styles.sourceChip}>
                                <Text style={styles.sourceText}>{source}</Text>
                                <Text style={styles.sourceCount}>{sourceStats.total}</Text>
                              </View>
                            ))}
                        </View>
                      )}
                    </View>
                  ))}
              </>
            )}

            {Object.keys(analytics).length === 0 && !isLoading && (
              <View style={styles.emptyState}>
                <Ionicons name="analytics-outline" size={48} color="#4a4a4a" />
                <Text style={styles.emptyText}>No analytics data yet</Text>
                <Text style={styles.emptySubtext}>Data will appear as users view your app</Text>
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    backgroundColor: '#1a1a1a',
  },
  headerSideButton: {
    width: 70,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 12,
    marginTop: 4,
  },
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  overviewCard: {
    width: '47%',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: 16,
    alignItems: 'center',
    gap: 6,
  },
  overviewNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
  },
  overviewLabel: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  itemCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: 14,
    marginBottom: 8,
  },
  itemName: {
    fontSize: 15,
    color: '#ffffff',
    fontWeight: '600',
    marginBottom: 8,
  },
  itemMetrics: {
    flexDirection: 'row',
    gap: 16,
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricValue: {
    fontSize: 14,
    color: '#e5e7eb',
    fontWeight: '600',
  },
  metricLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  sourcesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  sourcesLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  sourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 8,
    gap: 4,
  },
  sourceText: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '500',
  },
  sourceCount: {
    fontSize: 11,
    color: '#e5e7eb',
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#4a4a4a',
    textAlign: 'center',
  },
});
