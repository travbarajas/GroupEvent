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

  const getDisplayName = (stats: any, id: string): string => {
    return stats._name || id;
  };

  const renderStatCard = (label: string, total: number, unique: number, icon: string, color: string) => (
    <View style={styles.statCard}>
      <View style={[styles.statIconContainer, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statTotal}>{total.toLocaleString()}</Text>
      <Text style={styles.statUnique}>{unique.toLocaleString()} unique</Text>
    </View>
  );

  const renderSection = (title: string, icon: string, items: any) => {
    if (!items || Object.keys(items).length === 0) return null;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name={icon as any} size={18} color="#9ca3af" />
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        {Object.entries(items)
          .sort((a: any, b: any) => (b[1].page_view?.total || 0) - (a[1].page_view?.total || 0))
          .map(([id, stats]: [string, any]) => (
            <View key={id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemName} numberOfLines={1}>{getDisplayName(stats, id)}</Text>
                <View style={styles.itemStats}>
                  {stats.page_view && (
                    <View style={styles.itemStat}>
                      <Ionicons name="eye-outline" size={14} color="#60a5fa" />
                      <Text style={styles.itemStatText}>{stats.page_view.total}</Text>
                      <Text style={styles.itemStatUnique}>({stats.page_view.unique})</Text>
                    </View>
                  )}
                </View>
              </View>
              {/* Source breakdown */}
              {stats._sources && Object.keys(stats._sources).length > 0 && (
                <View style={styles.sourcesContainer}>
                  {Object.entries(stats._sources).map(([source, sourceStats]: [string, any]) => (
                    <View key={source} style={styles.sourceTag}>
                      <Text style={styles.sourceLabel}>{source}</Text>
                      <Text style={styles.sourceCount}>{sourceStats.total}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
      </View>
    );
  };

  // Calculate totals
  const sumStats = (items: any) => {
    if (!items) return { total: 0, unique: 0 };
    return Object.values(items).reduce(
      (sum: any, s: any) => ({
        total: sum.total + (s.page_view?.total || 0),
        unique: sum.unique + (s.page_view?.unique || 0),
      }),
      { total: 0, unique: 0 }
    );
  };

  const pageStats = analytics.page || {};
  const newsletterStats = analytics.newsletter || {};
  const eventStats = analytics.event || {};

  const pageTotals = sumStats(pageStats);
  const newsletterTotals = sumStats(newsletterStats);
  const eventTotals = sumStats(eventStats);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
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
            {/* Overview Cards */}
            <Text style={styles.overviewTitle}>Overview</Text>
            <View style={styles.statsGrid}>
              {renderStatCard('Page Views', pageTotals.total, pageTotals.unique, 'layers-outline', '#60a5fa')}
              {renderStatCard('Newsletters', newsletterTotals.total, newsletterTotals.unique, 'newspaper-outline', '#f59e0b')}
              {renderStatCard('Events', eventTotals.total, eventTotals.unique, 'calendar-outline', '#10b981')}
            </View>

            <Text style={styles.legendText}>
              <Ionicons name="eye-outline" size={12} color="#60a5fa" /> views (unique)  |  source tags show where clicks came from
            </Text>

            {/* Detailed Breakdowns */}
            {renderSection('Pages', 'layers-outline', pageStats)}
            {renderSection('Newsletters', 'newspaper-outline', newsletterStats)}
            {renderSection('Events', 'calendar-outline', eventStats)}

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
  overviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  legendText: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: 14,
    alignItems: 'center',
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
    marginBottom: 4,
  },
  statTotal: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
  },
  statUnique: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  itemCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: 14,
    color: '#e5e7eb',
    fontWeight: '500',
    flex: 1,
    marginRight: 12,
  },
  itemStats: {
    flexDirection: 'row',
    gap: 14,
  },
  itemStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemStatText: {
    fontSize: 14,
    color: '#e5e7eb',
    fontWeight: '600',
  },
  itemStatUnique: {
    fontSize: 12,
    color: '#6b7280',
  },
  sourcesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  sourceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    paddingVertical: 3,
    paddingHorizontal: 8,
    gap: 4,
  },
  sourceLabel: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '500',
  },
  sourceCount: {
    fontSize: 11,
    color: '#e5e7eb',
    fontWeight: '600',
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
