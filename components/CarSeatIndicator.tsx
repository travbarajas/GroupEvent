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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const [updatingSeats, setUpdatingSeats] = useState<Set<string>>(new Set());
  const [creatingCar, setCreatingCar] = useState(false);
  const [updatingCapacity, setUpdatingCapacity] = useState<Set<string>>(new Set());
  const insets = useSafeAreaInsets();

  // Load cars initially when we have required data
  useEffect(() => {
    if (groupId && currentUserId) {
      loadCars();
    }
  }, [groupId, eventId, currentUserId]);

  // Background polling for preview updates (slower)
  useEffect(() => {
    if (!groupId || !currentUserId) return;
    
    // Poll every 10 seconds for preview updates when component is mounted
    const backgroundPoll = setInterval(() => {
      loadCars();
    }, 10000);
    
    return () => clearInterval(backgroundPoll);
  }, [groupId, currentUserId]);

  // Fast polling when modal is open
  useEffect(() => {
    if (!showModal || !groupId) return;
    
    // Poll every 2 seconds when actively viewing modal
    const activePoll = setInterval(() => {
      loadCars();
    }, 2000);
    
    return () => clearInterval(activePoll);
  }, [showModal, groupId]);

  const loadCars = async () => {
    // Don't load if we don't have required data
    if (!groupId || !currentUserId) {
      console.log('Skipping loadCars - missing required data:', { groupId, currentUserId });
      return;
    }
    
    try {
      setLoading(true);
      
      const url = `https://group-event.vercel.app/api/groups/${groupId}/cars?device_id=${currentUserId}${eventId ? `&event_id=${eventId}` : ''}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const { cars: apiCars } = await response.json();
      setCars(apiCars || []);
    } catch (error) {
      console.error('Failed to load cars:', error);
      // Don't show alert for now, just log the error
      setCars([]);
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
    if (!currentUserId || creatingCar) return;
    
    try {
      setCreatingCar(true);
      const username = getCurrentUsername();
      
      // OPTIMISTIC UPDATE: Add car to UI immediately
      const tempCar = {
        id: `temp-${Date.now()}`, // Temporary ID
        name: `${username}'s vehicle`,
        capacity: 5,
        seats: Array(5).fill(null),
        createdBy: currentUserId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      setCars([...cars, tempCar]);
      
      // Background API call
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
      
      // Reload cars to get real data with proper IDs
      await loadCars();
    } catch (error) {
      console.error('Failed to create car:', error);
      Alert.alert('Error', 'Failed to create car. Please try again.');
      // Revert optimistic update on error
      await loadCars();
    } finally {
      setCreatingCar(false);
    }
  };

  // Join/leave car - fills in order, only one car per user
  const handleClaimSeat = async (carId: string) => {
    if (!currentUserId || updatingSeats.has(carId)) return;

    try {
      // Mark this car as updating to prevent multiple clicks
      setUpdatingSeats(prev => new Set([...prev, carId]));
      
      const car = cars.find(c => c.id === carId);
      if (!car) return;

      const userSeatIndex = car.seats.findIndex(seat => seat === currentUserId);
      const isLeaving = userSeatIndex !== -1;
      
      // OPTIMISTIC UPDATE: Update UI immediately
      const optimisticCars = cars.map(c => {
        const newSeats = [...c.seats];
        const userIndex = newSeats.findIndex(seat => seat === currentUserId);
        
        if (c.id === carId && !isLeaving) {
          // User joining this car - add to first empty spot
          const firstEmpty = newSeats.findIndex(seat => seat === null);
          if (firstEmpty !== -1) {
            newSeats[firstEmpty] = currentUserId;
          }
        } else if (userIndex !== -1) {
          // Remove user from any car they're currently in
          newSeats[userIndex] = null;
          // Compact seats (shift left)
          for (let i = userIndex; i < newSeats.length - 1; i++) {
            newSeats[i] = newSeats[i + 1];
            newSeats[i + 1] = null;
          }
        }
        
        return { ...c, seats: newSeats };
      });
      
      // Update UI immediately for instant feedback
      setCars(optimisticCars);
      
      const method = isLeaving ? 'DELETE' : 'POST';
      
      // Background API call
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
      
      // Reload from server to get authoritative state (and sync with other users)
      await loadCars();
    } catch (error) {
      console.error('Failed to update seat assignment:', error);
      Alert.alert('Error', 'Failed to update seat assignment. Please try again.');
      // Revert optimistic update on error
      await loadCars();
    } finally {
      // Remove car from updating set
      setUpdatingSeats(prev => {
        const newSet = new Set(prev);
        newSet.delete(carId);
        return newSet;
      });
    }
  };

  // Count occupied seats
  const getOccupiedSeats = (car: Car) => {
    return car.seats.filter(seat => seat !== null).length;
  };

  // Change car capacity (only creator can do this)
  const handleCapacityChange = async (carId: string, delta: number) => {
    const car = cars.find(c => c.id === carId);
    if (!car || car.createdBy !== currentUserId) return;

    const newCapacity = Math.max(1, car.capacity + delta); // Min 1, no max
    if (newCapacity === car.capacity) return; // No change needed
    
    // OPTIMISTIC UPDATE: Update UI immediately without any blocking
    const optimisticCars = cars.map(c => {
      if (c.id === carId) {
        const newSeats = Array(newCapacity).fill(null);
        // Copy existing seats up to new capacity
        for (let i = 0; i < Math.min(c.seats.length, newCapacity); i++) {
          newSeats[i] = c.seats[i];
        }
        return { ...c, capacity: newCapacity, seats: newSeats };
      }
      return c;
    });
    
    // Update UI immediately for instant feedback
    setCars(optimisticCars);
    
    // Background API call (fire and forget for speed)
    fetch(`https://group-event.vercel.app/api/groups/${groupId}/cars/${carId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        device_id: currentUserId,
        capacity: newCapacity
      }),
    }).catch(error => {
      console.error('Failed to update car capacity:', error);
      // Silently revert on error after a delay
      setTimeout(() => loadCars(), 1000);
    });
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
            style={[
              styles.seatsRowContainer,
              updatingSeats.has(car.id) && styles.seatsRowUpdating
            ]}
            onPress={() => handleClaimSeat(car.id)}
            activeOpacity={0.7}
            disabled={updatingSeats.has(car.id)}
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
        </View>
        
        {/* 2x2 grid: capacity, X, minus, plus */}
        <View style={styles.controlsGrid}>
          <View style={styles.gridTopRow}>
            <View style={styles.capacityBox}>
              <Text style={styles.capacityText}>
                {getOccupiedSeats(car)}/{car.capacity}
              </Text>
            </View>
            
            {isCreator && (
              <TouchableOpacity 
                style={styles.deleteButton}
                onPress={() => handleDeleteVehicle(car.id)}
              >
                <Ionicons 
                  name="close" 
                  size={12} 
                  color="#ef4444" 
                />
              </TouchableOpacity>
            )}
          </View>
          
          {isCreator && (
            <View style={styles.gridBottomRow}>
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
              >
                <Ionicons 
                  name="add" 
                  size={12} 
                  color="#60a5fa"
                />
              </TouchableOpacity>
            </View>
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
          <View style={[styles.modalHeader, { paddingTop: insets.top + 12 }]}>
            <TouchableOpacity onPress={() => setShowModal(false)} style={styles.backButton}>
              <Ionicons name="chevron-back" size={24} color="#ffffff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Car Seats</Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Content */}
          <ScrollView style={styles.modalContent}>
            {/* Add Car Button */}
            <TouchableOpacity 
              style={[
                styles.addCarButton,
                creatingCar && styles.addCarButtonDisabled
              ]}
              onPress={handleAddCar}
              disabled={creatingCar}
            >
              <Ionicons 
                name="add" 
                size={20} 
                color={creatingCar ? "#666" : "#60a5fa"} 
              />
              <Text style={[
                styles.addCarText,
                creatingCar && styles.addCarTextDisabled
              ]}>
                {creatingCar ? 'Creating...' : 'Add Car'}
              </Text>
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
    paddingBottom: 12,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  backButton: {
    padding: 4,
    marginRight: 8,
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
  addCarButtonDisabled: {
    opacity: 0.5,
    borderColor: '#666',
  },
  addCarTextDisabled: {
    color: '#666',
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
    justifyContent: 'center',
  },
  seatsRowContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    flex: 1,
  },
  seatsRowUpdating: {
    opacity: 0.7,
  },
  seatsRow: {
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  seatPill: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    backgroundColor: 'transparent',
  },
  controlsGrid: {
    flex: 0.2,
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 6,
  },
  gridTopRow: {
    flexDirection: 'row',
    gap: 6,
  },
  gridBottomRow: {
    flexDirection: 'row',
    gap: 6,
  },
  capacityBox: {
    width: 36,
    height: 36,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capacityButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  capacityText: {
    fontSize: 10,
    color: '#9ca3af',
    fontWeight: '600',
    textAlign: 'center',
  },
  capacityButtonRowUnder: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
    justifyContent: 'center',
  },
  capacityButtonRowUpdating: {
    opacity: 0.7,
  },
  capacityButtonUpdating: {
    opacity: 0.5,
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
});