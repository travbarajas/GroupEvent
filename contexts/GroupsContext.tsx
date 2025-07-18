import React, { createContext, useContext, useState, ReactNode } from 'react';

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
  createGroup: (name: string) => Group;
  getGroup: (id: string) => Group | undefined;
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

  const generateId = () => `group_${Date.now()}`;

  const createGroup = (name: string): Group => {
    const newGroup: Group = {
      id: generateId(),
      name: name.trim(),
      memberCount: 1, // Just the creator for now
      createdAt: new Date(),
    };
    
    setGroups(prevGroups => [...prevGroups, newGroup]);
    return newGroup;
  };

  const getGroup = (id: string): Group | undefined => {
    return groups.find(group => group.id === id);
  };

  const value: GroupsContextType = {
    groups,
    createGroup,
    getGroup,
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