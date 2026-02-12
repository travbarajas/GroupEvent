import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/useThemeColor';

interface EventBlockProps {
  event: {
    id?: string;
    name: string;
    description?: string;
    short_description?: string;
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
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Image Bubble */}
      <View style={[styles.imageBubble, { backgroundColor: '#2a2a2a' }]}>
        {event.image_url ? (
          <Image source={{ uri: event.image_url }} style={styles.image} />
        ) : (
          <View style={styles.placeholderImage} />
        )}
      </View>

      {/* Event Content */}
      <View style={styles.content}>
        {/* Event Title */}
        <Text style={[styles.title, { color: textColor }]} numberOfLines={2}>
          {event.name}
        </Text>

        {/* Short Description */}
        {(event.short_description || event.description) && (
          <Text style={[styles.description, { color: iconColor }]} numberOfLines={2}>
            {event.short_description || event.description}
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
    alignSelf: 'flex-start',
    marginVertical: 8,
    marginLeft: 16,
    marginRight: 'auto',
    maxWidth: '85%',
  },
  imageBubble: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  image: {
    width: 64,
    height: 64,
    borderRadius: 32,
    resizeMode: 'cover',
  },
  placeholderImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#404040',
  },
  content: {
    paddingLeft: 0,
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