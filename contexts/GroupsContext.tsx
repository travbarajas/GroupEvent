import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiService } from '@/services/api';

export interface Group {
  id: string;
  name: string;
  memberCount: number;
  createdAt: Date;
}

export interface Event {
  id: number;
  name: string;
  date: string;
  description: string;
  time: string;
  price: string;
  distance: string;
  type: 'festival' | 'music' | 'outdoor' | 'food';
}

interface GroupsContextType {
  groups: Group[];
  createGroup: (name: string) => Promise<Group>;
  getGroup: (id: string) => Group | undefined;
  loadGroups: () => Promise<void>;
  selectedEvent: Event | null;
  sourceLayout: any;
  setSelectedEvent: (event: Event | null) => void;
  setSourceLayout: (layout: any) => void;
  savedEvents: Event[];
  setSavedEvents: React.Dispatch<React.SetStateAction<Event[]>>;
  toggleSaveEvent: (event: Event) => void;
  isEventSaved: (eventId: number) => boolean;
  isLoaded: boolean;
}

const GroupsContext = createContext<GroupsContextType | undefined>(undefined);

export const useGroups = () => {
  const context = useContext(GroupsContext);
  if (!context) {
    throw new Error('useGroups must be used within a GroupsProvider');
  }
  return context;
};

interface GroupsProviderProps {
  children: ReactNode;
}

const SAVED_EVENTS_KEY = '@saved_events';

export const GroupsProvider: React.FC<GroupsProviderProps> = ({ children }) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [sourceLayout, setSourceLayout] = useState<any>(null);
  const [savedEvents, setSavedEvents] = useState<Event[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved events from AsyncStorage on app start
  useEffect(() => {
    loadSavedEvents();
  }, []);

  const loadSavedEvents = async () => {
    try {
      const savedEventsJson = await AsyncStorage.getItem(SAVED_EVENTS_KEY);
      if (savedEventsJson) {
        const events = JSON.parse(savedEventsJson);
        setSavedEvents(events);
      }
    } catch (error) {
      console.error('Failed to load saved events:', error);
    } finally {
      setIsLoaded(true);
    }
  };

  const saveSavedEvents = async (events: Event[]) => {
    try {
      await AsyncStorage.setItem(SAVED_EVENTS_KEY, JSON.stringify(events));
    } catch (error) {
      console.error('Failed to save events:', error);
    }
  };

  const loadGroups = async () => {
    try {
      const fetchedGroups = await ApiService.getAllGroups();
      setGroups(fetchedGroups.map(g => ({
        id: g.id,
        name: g.name,
        memberCount: g.member_count,
        createdAt: new Date(g.created_at)
      })));
    } catch (error) {
      console.error('Failed to load groups:', error);
    }
  };

  const createGroup = async (name: string): Promise<Group> => {
    try {
      const response = await ApiService.createGroup({ 
        name: name.trim(),
        description: 'Ready to plan some events together!'
      });
      
      const newGroup: Group = {
        id: response.id,
        name: response.name,
        memberCount: response.member_count,
        createdAt: new Date(response.created_at),
      };
      
      setGroups(prevGroups => [...prevGroups, newGroup]);
      return newGroup;
    } catch (error) {
      console.error('Failed to create group:', error);
      throw error;
    }
  };

  const getGroup = (id: string): Group | undefined => {
    return groups.find(group => group.id === id);
  };

  const toggleSaveEvent = (event: Event) => {
    setSavedEvents(prev => {
      const isAlreadySaved = prev.some(savedEvent => savedEvent.id === event.id);
      let newSavedEvents;
      
      if (isAlreadySaved) {
        newSavedEvents = prev.filter(savedEvent => savedEvent.id !== event.id);
      } else {
        newSavedEvents = [...prev, event];
      }
      
      // Persist to AsyncStorage
      saveSavedEvents(newSavedEvents);
      
      return newSavedEvents;
    });
  };

  const isEventSaved = (eventId: number): boolean => {
    return savedEvents.some(event => event.id === eventId);
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const value: GroupsContextType = {
    groups,
    createGroup,
    getGroup,
    loadGroups,
    selectedEvent,
    sourceLayout,
    setSelectedEvent,
    setSourceLayout,
    savedEvents,
    setSavedEvents,
    toggleSaveEvent,
    isEventSaved,
    isLoaded,
  };

  return (
    <GroupsContext.Provider value={value}>
      {children}
    </GroupsContext.Provider>
  );
};