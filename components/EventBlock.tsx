import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/useThemeColor';

interface EventBlockProps {
  event: {
    id?: string;
    name: string;
    description?: string;
    date: string;
    time?: string;
    price?: number | string;
    is_free?: boolean;
    location?: string;
    venue_name?: string;
    image_url?: string;
  };
  onPress?: () => void;
}

export default function EventBlock({ event, onPress }: EventBlockProps) {
  const textColor = useThemeColor({}, 'text');
  const backgroundColor = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');

  const formatPrice = () => {
    if (event.is_free) return 'Free';
    if (!event.price) return 'Price TBA';
    if (typeof event.price === 'string') return event.price;
    return `$${event.price}`;
  };

  const formatDateTime = () => {
    if (!event.date) return '';
    
    try {
      const date = new Date(event.date);
      const dateStr = date.toLocaleDateString([], { 
        weekday: 'short',
        month: 'short', 
        day: 'numeric'
      });
      
      if (event.time) {
        return `${dateStr} • ${event.time}`;
      }
      
      return dateStr;
    } catch {
      return event.date + (event.time ? ` • ${event.time}` : '');
    }
  };

  const formatLocation = () => {
    if (event.venue_name && event.location) {
      return `${event.venue_name}, ${event.location}`;
    }
    return event.venue_name || event.location || '';
  };

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: '#2a2a2a', borderColor: '#3a3a3a' }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Placeholder Image */}
      <View style={styles.imageContainer}>
        {event.image_url ? (
          <Image source={{ uri: event.image_url }} style={styles.image} />
        ) : (
          <View style={[styles.placeholderImage, { backgroundColor: '#1a1a1a' }]}>
            <Ionicons name="calendar-outline" size={32} color={iconColor} />
          </View>
        )}
      </View>

      {/* Event Content */}
      <View style={styles.content}>
        {/* Event Title */}
        <Text style={[styles.title, { color: textColor }]} numberOfLines={2}>
          {event.name}
        </Text>

        {/* Short Description */}
        {event.description && (
          <Text style={[styles.description, { color: iconColor }]} numberOfLines={2}>
            {event.description}
          </Text>
        )}

        {/* Time and Date */}
        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={16} color={tintColor} />
          <Text style={[styles.infoText, { color: textColor }]}>
            {formatDateTime()}
          </Text>
        </View>

        {/* Price */}
        <View style={styles.infoRow}>
          <Ionicons name="pricetag-outline" size={16} color={tintColor} />
          <Text style={[styles.infoText, { color: textColor }]}>
            {formatPrice()}
          </Text>
        </View>

        {/* Location */}
        {formatLocation() && (
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={16} color={tintColor} />
            <Text style={[styles.infoText, { color: textColor }]} numberOfLines={1}>
              {formatLocation()}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 12,
    marginVertical: 8,
    marginHorizontal: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  imageContainer: {
    width: '100%',
    height: 120,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
    lineHeight: 22,
  },
  description: {
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 18,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  infoText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
});