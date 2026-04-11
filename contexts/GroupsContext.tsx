import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiService } from '@/services/api';

export interface Group {
  id: string;
  name: string;
  memberCount: number;
  createdAt: Date;
  lastAccessedAt?: Date;
}

export interface Event {
  id: number;
  name: string;
  date: string;
  description: string;
  short_description?: string;
  time: string;
  price: string;
  distance: string;
  type: string; // Made flexible instead of restricted to specific types
  tags: string[];
  location?: string;
  venue_name?: string;
  image_url?: string;
  website_url?: string;
  link_label?: string;
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
  updateGroupAccess: (groupId: string) => void;
  getMostRecentGroup: () => Group | null;
  exploreEvents: Event[];
  exploreEventsLoading: boolean;
  tagOrder: string[];
  refreshExploreEvents: () => Promise<void>;
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
  const [exploreEvents, setExploreEvents] = useState<Event[]>([]);
  const [exploreEventsLoading, setExploreEventsLoading] = useState(true);
  const [tagOrder, setTagOrder] = useState<string[]>([]);

  // Load saved events from AsyncStorage on app start
  useEffect(() => {
    loadSavedEvents();
    refreshExploreEvents();
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

  const refreshExploreEvents = async () => {
    setExploreEventsLoading(true);
    try {
      const [{ events: apiEvents }, tagResult] = await Promise.all([
        ApiService.getAllEvents(),
        ApiService.getTagOrder().catch(() => ({ tags: [] })),
      ]);

      setTagOrder(tagResult.tags.map((t: any) => t.tag_name));

      if (apiEvents && apiEvents.length > 0) {
        const formatted: Event[] = apiEvents.map((apiEvent: any) => ({
          id: parseInt(apiEvent.id.replace('EVT_', '')) || Math.random(),
          name: apiEvent.name,
          date: apiEvent.date || 'TBD',
          description: apiEvent.description || '',
          short_description: apiEvent.short_description || '',
          time: apiEvent.time || 'TBD',
          price: apiEvent.is_free ? 'Free' : `$${apiEvent.price} ${apiEvent.currency}`,
          distance: '',
          type: apiEvent.category || 'music',
          tags: apiEvent.tags || [],
          image_url: apiEvent.image_url || undefined,
          location: apiEvent.location || undefined,
          venue_name: apiEvent.venue_name || undefined,
          website_url: apiEvent.website_url || undefined,
          link_label: apiEvent.link_label || undefined,
        }));

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const cutoff = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);

        setExploreEvents(formatted.filter(event => {
          if (!event.date || event.date === 'TBD') return true;
          const datePart = event.date.split(' to ')[0];
          const eventDate = new Date(datePart + 'T00:00:00');
          if (isNaN(eventDate.getTime())) return true;
          return eventDate >= today && eventDate <= cutoff;
        }));
      } else {
        setExploreEvents([]);
      }
    } catch {
      setExploreEvents([]);
    } finally {
      setExploreEventsLoading(false);
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

  const updateGroupAccess = (groupId: string) => {
    setGroups(prevGroups => 
      prevGroups.map(group => 
        group.id === groupId 
          ? { ...group, lastAccessedAt: new Date() }
          : group
      )
    );
  };

  const getMostRecentGroup = (): Group | null => {
    if (groups.length === 0) return null;
    
    // First, try to find the most recently accessed group
    const groupsWithAccess = groups.filter(group => group.lastAccessedAt);
    if (groupsWithAccess.length > 0) {
      return groupsWithAccess.reduce((most, current) => 
        (current.lastAccessedAt! > most.lastAccessedAt!) ? current : most
      );
    }
    
    // If no groups have been accessed, return the most recently created
    return groups.reduce((most, current) => 
      current.createdAt > most.createdAt ? current : most
    );
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
    updateGroupAccess,
    getMostRecentGroup,
    exploreEvents,
    exploreEventsLoading,
    tagOrder,
    refreshExploreEvents,
  };

  return (
    <GroupsContext.Provider value={value}>
      {children}
    </GroupsContext.Provider>
  );
};