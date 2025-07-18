import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
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

export const GroupsProvider: React.FC<GroupsProviderProps> = ({ children }) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [sourceLayout, setSourceLayout] = useState<any>(null);

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
  };

  return (
    <GroupsContext.Provider value={value}>
      {children}
    </GroupsContext.Provider>
  );
};