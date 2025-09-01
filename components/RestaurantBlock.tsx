import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/useThemeColor';

interface RestaurantData {
  id?: string;
  name: string;
  cuisine?: string;
  rating?: number;
  price_level?: string;
  address?: string;
  phone?: string;
  description?: string;
  image_url?: string;
}

interface RestaurantBlockProps {
  restaurant: RestaurantData;
  onPress?: () => void;
}

export default function RestaurantBlock({ restaurant, onPress }: RestaurantBlockProps) {
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <Ionicons key={`full-${i}`} name="star" size={14} color="#FFD700" />
      );
    }
    
    if (hasHalfStar) {
      stars.push(
        <Ionicons key="half" name="star-half" size={14} color="#FFD700" />
      );
    }
    
    const emptyStars = 5 - Math.ceil(rating);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(
        <Ionicons key={`empty-${i}`} name="star-outline" size={14} color="#C0C0C0" />
      );
    }
    
    return stars;
  };

  const getPriceLevelDisplay = (priceLevel: string) => {
    if (priceLevel === '$') return '$';
    if (priceLevel === '$$') return '$$';
    if (priceLevel === '$$$') return '$$$';
    if (priceLevel === '$$$$') return '$$$$';
    return priceLevel;
  };

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor, borderColor: iconColor + '40' }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <Text style={[styles.name, { color: textColor }]} numberOfLines={2}>
          {restaurant.name}
        </Text>
        {restaurant.price_level && (
          <Text style={[styles.priceLevel, { color: tintColor }]}>
            {getPriceLevelDisplay(restaurant.price_level)}
          </Text>
        )}
      </View>

      {restaurant.cuisine && (
        <Text style={[styles.cuisine, { color: iconColor }]}>
          {restaurant.cuisine}
        </Text>
      )}

      {restaurant.rating && (
        <View style={styles.ratingContainer}>
          <View style={styles.stars}>
            {renderStars(restaurant.rating)}
          </View>
          <Text style={[styles.ratingText, { color: textColor }]}>
            {restaurant.rating.toFixed(1)}
          </Text>
        </View>
      )}

      {restaurant.address && (
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={14} color={iconColor} />
          <Text style={[styles.address, { color: iconColor }]} numberOfLines={2}>
            {restaurant.address}
          </Text>
        </View>
      )}

      {restaurant.phone && (
        <View style={styles.infoRow}>
          <Ionicons name="call-outline" size={14} color={iconColor} />
          <Text style={[styles.phone, { color: iconColor }]}>
            {restaurant.phone}
          </Text>
        </View>
      )}

      {restaurant.description && (
        <Text style={[styles.description, { color: textColor }]} numberOfLines={3}>
          {restaurant.description}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 8,
  },
  priceLevel: {
    fontSize: 16,
    fontWeight: '600',
  },
  cuisine: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  stars: {
    flexDirection: 'row',
    marginRight: 8,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  address: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  phone: {
    fontSize: 14,
    marginLeft: 8,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
});