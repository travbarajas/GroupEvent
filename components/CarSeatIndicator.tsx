import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ApiService } from '@/services/api';

interface Car {
  id: string;
  name: string;
  capacity: number;
  seats: (string | null)[]; // user IDs or null for empty seats
  createdBy: string;
}

interface CarSeatIndicatorProps {
  groupId: string;
  eventId?: string;
  currentUserId?: string;
  userColor?: string;
  members: any[];
}

export default function CarSeatIndicator({ 
  groupId, 
  eventId,
  currentUserId, 
  userColor,
  members 
}: CarSeatIndicatorProps) {
  const [cars, setCars] = useState<Car[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingCarName, setEditingCarName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (showModal) {
      loadCars();
    }
  }, [showModal]);

  const loadCars = async () => {
    try {
      setLoading(true);
      console.log('ApiService methods:', Object.getOwnPropertyNames(ApiService));
      console.log('getGroupCars method:', ApiService.getGroupCars);
      
      // Direct API call as workaround
      const response = await fetch(`https://group-event.vercel.app/api/groups/${groupId}/cars?device_id=${currentUserId}${eventId ? `&event_id=${eventId}` : ''}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const { cars: apiCars } = await response.json();
      setCars(apiCars);
    } catch (error) {
      console.error('Failed to load cars:', error);
      Alert.alert('Error', 'Failed to load cars. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Get user color by ID
  const getUserColor = (userId: string) => {
    const member = members.find(m => m.device_id === userId);
    return member?.color || '#60a5fa';
  };

  // Get current user's username
  const getCurrentUsername = () => {
    const currentMember = members.find(m => m.device_id === currentUserId);
    return currentMember?.username || 'Someone';
  };

  // Add a new car
  const handleAddCar = async () => {
    if (!currentUserId) return;
    
    try {
      const username = getCurrentUsername();
      
      // Direct API call as workaround
      const response = await fetch(`https://group-event.vercel.app/api/groups/${groupId}/cars`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          device_id: currentUserId,
          name: `${username}'s vehicle`,
          capacity: 5,
          event_id: eventId
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Reload cars to get the latest data
      await loadCars();
    } catch (error) {
      console.error('Failed to create car:', error);
      Alert.alert('Error', 'Failed to create car. Please try again.');
    }
  };

  // Join/leave car - fills in order, only one car per user
  const handleClaimSeat = async (carId: string) => {
    if (!currentUserId) return;

    try {
      const car = cars.find(c => c.id === carId);
      if (!car) return;

      const userSeatIndex = car.seats.findIndex(seat => seat === currentUserId);
      
      const method = userSeatIndex !== -1 ? 'DELETE' : 'POST';
      
      // Direct API call as workaround
      const response = await fetch(`https://group-event.vercel.app/api/groups/${groupId}/cars/${carId}/seats`, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          device_id: currentUserId
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Reload cars to get the latest data
      await loadCars();
    } catch (error) {
      console.error('Failed to update seat assignment:', error);
      Alert.alert('Error', 'Failed to update seat assignment. Please try again.');
    }
  };

  // Count occupied seats
  const getOccupiedSeats = (car: Car) => {
    return car.seats.filter(seat => seat !== null).length;
  };

  // Change car capacity (only creator can do this)
  const handleCapacityChange = async (carId: string, delta: number) => {
    try {
      const car = cars.find(c => c.id === carId);
      if (!car || car.createdBy !== currentUserId) return;

      const newCapacity = Math.max(1, car.capacity + delta); // Min 1, no max
      
      // Direct API call as workaround
      const response = await fetch(`https://group-event.vercel.app/api/groups/${groupId}/cars/${carId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          device_id: currentUserId,
          capacity: newCapacity
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Reload cars to get the latest data
      await loadCars();
    } catch (error) {
      console.error('Failed to update car capacity:', error);
      Alert.alert('Error', 'Failed to update car capacity. Please try again.');
    }
  };

  // Change car name (only creator can do this)
  const handleNameChange = async (carId: string, newName: string) => {
    try {
      const car = cars.find(c => c.id === carId);
      if (!car || car.createdBy !== currentUserId) return;
      
      // Direct API call as workaround
      const response = await fetch(`https://group-event.vercel.app/api/groups/${groupId}/cars/${carId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          device_id: currentUserId,
          name: newName
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Update local state immediately for better UX
      setCars(cars.map(car => {
        if (car.id === carId) {
          return { ...car, name: newName };
        }
        return car;
      }));
    } catch (error) {
      console.error('Failed to update car name:', error);
      Alert.alert('Error', 'Failed to update car name. Please try again.');
      // Reload cars to revert any local changes
      await loadCars();
    }
  };

  // Delete vehicle (only creator can do this)
  const handleDeleteVehicle = async (carId: string) => {
    try {
      const car = cars.find(c => c.id === carId);
      if (!car || car.createdBy !== currentUserId) return;
      
      // Direct API call as workaround
      const response = await fetch(`https://group-event.vercel.app/api/groups/${groupId}/cars/${carId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          device_id: currentUserId
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Reload cars to get the latest data
      await loadCars();
    } catch (error) {
      console.error('Failed to delete car:', error);
      Alert.alert('Error', 'Failed to delete car. Please try again.');
    }
  };

  const renderCar = (car: Car) => {
    const isCreator = car.createdBy === currentUserId;
    const isEditingName = editingCarName === car.id;
    
    return (
      <View key={car.id} style={styles.carContainer}>
        {/* Car name on the left - editable for creator */}
        {isEditingName ? (
          <TextInput
            style={styles.carNameInput}
            value={car.name}
            onChangeText={(text) => handleNameChange(car.id, text)}
            onBlur={() => setEditingCarName(null)}
            onSubmitEditing={() => setEditingCarName(null)}
            autoFocus
            maxLength={20}
          />
        ) : (
          <TouchableOpacity
            style={styles.carNameContainer}
            onPress={() => {
              if (isCreator) {
                setEditingCarName(car.id);
              } else {
                handleClaimSeat(car.id);
              }
            }}
          >
            <Text style={styles.carName}>{car.name}</Text>
          </TouchableOpacity>
        )}
        
        {/* Horizontal seat pills in the middle - entire area clickable */}
        <View style={styles.seatsAndControlsContainer}>
          <TouchableOpacity 
            style={styles.seatsRowContainer}
            onPress={() => handleClaimSeat(car.id)}
            activeOpacity={0.7}
          >
            <View style={styles.seatsRow}>
              {car.seats.map((seat, index) => (
                <View
                  key={index}
                  style={[
                    styles.seatPill,
                    seat && { backgroundColor: getUserColor(seat) }
                  ]}
                />
              ))}
            </View>
          </TouchableOpacity>
          
          {/* Plus/minus buttons under the seat pills */}
          {isCreator && (
            <View style={styles.capacityButtonRowUnder}>
              <TouchableOpacity 
                style={styles.capacityButton}
                onPress={() => handleCapacityChange(car.id, -1)}
                disabled={car.capacity <= 1}
              >
                <Ionicons 
                  name="remove" 
                  size={12} 
                  color={car.capacity <= 1 ? '#666' : '#60a5fa'} 
                />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.capacityButton}
                onPress={() => handleCapacityChange(car.id, 1)}
                disabled={false}
              >
                <Ionicons 
                  name="add" 
                  size={12} 
                  color={'#60a5fa'} 
                />
              </TouchableOpacity>
            </View>
          )}
        </View>
        
        {/* Capacity count and delete button on the right */}
        <View style={styles.capacityContainer}>
          <Text style={styles.capacityText}>
            {getOccupiedSeats(car)}/{car.capacity}
          </Text>
          {isCreator && (
            <TouchableOpacity 
              style={styles.deleteButton}
              onPress={() => handleDeleteVehicle(car.id)}
            >
              <Ionicons 
                name="close" 
                size={10} 
                color="#ef4444" 
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <>
      {/* Car Seat Block - Same size as calendar block */}
      <TouchableOpacity 
        style={styles.carSeatBlock}
        activeOpacity={0.8}
        onPress={() => setShowModal(true)}
      >
        <View style={styles.carSeatHeader}>
          <Ionicons name="car-sport" size={20} color="#60a5fa" />
          <Text style={styles.carSeatTitle}>Car Seats</Text>
          <Ionicons name="chevron-forward" size={14} color="#9ca3af" />
        </View>
        
        {cars.length === 0 ? (
          <Text style={styles.noCarText}>No cars added</Text>
        ) : (
          <View style={styles.carListPreview}>
            {cars.map(car => (
              <View key={car.id} style={styles.carPreviewItem}>
                <Text style={styles.carPreviewName}>{car.name}</Text>
                <Text style={styles.carPreviewCapacity}>
                  {getOccupiedSeats(car)}/{car.capacity}
                </Text>
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>

      {/* Car Seat Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={showModal}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Ionicons name="close" size={24} color="#ffffff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Car Seats</Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Content */}
          <ScrollView style={styles.modalContent}>
            {/* Add Car Button */}
            <TouchableOpacity 
              style={styles.addCarButton}
              onPress={handleAddCar}
            >
              <Ionicons name="add" size={20} color="#60a5fa" />
              <Text style={styles.addCarText}>Add Car</Text>
            </TouchableOpacity>

            {/* Cars List */}
            {cars.map(renderCar)}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  carSeatBlock: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: 16,
    flex: 1,
  },
  carSeatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  carSeatTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 6,
    flex: 1,
  },
  noCarText: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8,
  },
  carListPreview: {
    gap: 8,
  },
  carPreviewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  carPreviewName: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '500',
    flex: 1,
  },
  carPreviewCapacity: {
    fontSize: 12,
    color: '#60a5fa',
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  headerSpacer: {
    width: 24,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  addCarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#60a5fa',
    padding: 16,
    marginBottom: 16,
  },
  addCarText: {
    fontSize: 14,
    color: '#60a5fa',
    fontWeight: '600',
    marginLeft: 8,
  },
  carContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  carNameContainer: {
    flex: 0.3,
  },
  carName: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
  },
  carNameInput: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
    backgroundColor: '#2a2a2a',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flex: 0.3,
  },
  seatsAndControlsContainer: {
    flex: 0.5,
    alignItems: 'center',
  },
  seatsRowContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  seatsRow: {
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  seatPill: {
    width: 18,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    backgroundColor: 'transparent',
  },
  capacityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 0.2,
    justifyContent: 'center',
    gap: 6,
  },
  capacityButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  capacityText: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
    textAlign: 'center',
  },
  capacityButtonRowUnder: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
    justifyContent: 'center',
  },
  deleteButton: {
    width: 18,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
});