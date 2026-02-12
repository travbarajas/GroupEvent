import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Newsletter, NewsletterContextType } from '@/types/newsletter';
import { ApiService } from '@/services/api';
import { DeviceIdManager } from '@/utils/deviceId';

const NewsletterContext = createContext<NewsletterContextType | undefined>(undefined);

export const useNewsletter = () => {
  const context = useContext(NewsletterContext);
  if (!context) {
    throw new Error('useNewsletter must be used within a NewsletterProvider');
  }
  return context;
};

interface NewsletterProviderProps {
  children: ReactNode;
}

const NEWSLETTERS_KEY = '@newsletters';
const ADMIN_DEVICE_ID = process.env.EXPO_PUBLIC_ADMIN_DEVICE_ID || '';

export const NewsletterProvider: React.FC<NewsletterProviderProps> = ({ children }) => {
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [currentNewsletter, setCurrentNewsletter] = useState<Newsletter | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    loadNewsletters();
    checkAdminStatus();
  }, []);

  const loadNewsletters = async () => {
    try {
      // Try to load from server first
      try {
        const { newsletters: serverNewsletters } = await ApiService.getAllNewsletters();
        const parsedNewsletters = serverNewsletters.map((newsletter: any) => ({
          ...newsletter,
          isPublished: newsletter.is_published || newsletter.isPublished || false,
          createdAt: new Date(newsletter.created_at || newsletter.createdAt),
          publishedAt: newsletter.published_at ? new Date(newsletter.published_at) : null,
        }));
        setNewsletters(parsedNewsletters);
        return;
      } catch (serverError) {
        console.log('Server unavailable, loading from local storage:', serverError);
      }

      // Fallback to local storage for migration
      const newslettersJson = await AsyncStorage.getItem(NEWSLETTERS_KEY);
      if (newslettersJson) {
        const loadedNewsletters = JSON.parse(newslettersJson);
        // Convert date strings back to Date objects and migrate old format
        const parsedNewsletters = loadedNewsletters.map((newsletter: any) => {
          let migratedNewsletter = {
            ...newsletter,
            createdAt: new Date(newsletter.createdAt),
            publishedAt: newsletter.publishedAt ? new Date(newsletter.publishedAt) : null,
          };
          
          // Migrate old content format to new format
          if (Array.isArray(newsletter.content)) {
            // Old format: array of content objects
            const contentText = newsletter.content
              .sort((a: any, b: any) => a.order - b.order)
              .map((item: any) => {
                switch (item.type) {
                  case 'heading':
                    const prefix = '#'.repeat(item.level || 1);
                    return `${prefix} ${item.content}`;
                  case 'link':
                    return `[${item.content}](${item.href || ''})`;
                  case 'text':
                  default:
                    return item.content;
                }
              })
              .join('\n\n');
            
            migratedNewsletter = {
              ...migratedNewsletter,
              content: contentText,
              subtitle: '',
              date: new Date(newsletter.createdAt).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              }),
              readOnlineUrl: '',
              events: [],
              startDate: '',
              endDate: '',
            };
          } else if (typeof newsletter.content !== 'string') {
            // Handle undefined or other invalid content
            migratedNewsletter.content = '';
          }
          
          // Ensure all required fields exist
          if (!migratedNewsletter.subtitle) migratedNewsletter.subtitle = '';
          if (!migratedNewsletter.date) {
            migratedNewsletter.date = new Date(newsletter.createdAt).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            });
          }
          if (!migratedNewsletter.readOnlineUrl) migratedNewsletter.readOnlineUrl = '';
          if (!migratedNewsletter.events) migratedNewsletter.events = [];
          if (!migratedNewsletter.startDate) migratedNewsletter.startDate = '';
          if (!migratedNewsletter.endDate) migratedNewsletter.endDate = '';
          
          return migratedNewsletter;
        });
        
        setNewsletters(parsedNewsletters);
        
        // Save migrated data back to storage
        await saveNewsletters(parsedNewsletters);
      }
    } catch (error) {
      console.error('Failed to load newsletters:', error);
    }
  };

  const saveNewsletters = async (newslettersToSave: Newsletter[]) => {
    try {
      await AsyncStorage.setItem(NEWSLETTERS_KEY, JSON.stringify(newslettersToSave));
    } catch (error) {
      console.error('Failed to save newsletters:', error);
    }
  };

  const checkAdminStatus = async () => {
    try {
      if (!ADMIN_DEVICE_ID) {
        setIsAdmin(false);
        return;
      }
      const deviceId = await DeviceIdManager.getDeviceId();
      setIsAdmin(deviceId === ADMIN_DEVICE_ID);
    } catch (error) {
      console.error('Failed to check admin status:', error);
      setIsAdmin(false);
    }
  };

  const createNewsletter = async (title: string): Promise<Newsletter> => {
    if (!isAdmin) {
      throw new Error('Only admins can create newsletters');
    }

    const today = new Date();
    const dateString = today.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    try {
      const serverNewsletter = await ApiService.createNewsletter({
        title: title.trim(),
        subtitle: '',
        date: dateString,
        readOnlineUrl: '',
        content: '',
        events: [],
        startDate: '',
        endDate: '',
      });

      const newNewsletter: Newsletter = {
        id: serverNewsletter.id,
        title: serverNewsletter.title,
        subtitle: serverNewsletter.subtitle || '',
        date: serverNewsletter.date,
        readOnlineUrl: serverNewsletter.readOnlineUrl || '',
        content: serverNewsletter.content || '',
        events: serverNewsletter.events || [],
        startDate: serverNewsletter.startDate || '',
        endDate: serverNewsletter.endDate || '',
        createdAt: new Date(serverNewsletter.created_at),
        publishedAt: serverNewsletter.published_at ? new Date(serverNewsletter.published_at) : null,
        isPublished: serverNewsletter.isPublished || false,
        isAdminOnly: true,
      };

      const updatedNewsletters = [...newsletters, newNewsletter];
      setNewsletters(updatedNewsletters);
      await saveNewsletters(updatedNewsletters);

      return newNewsletter;
    } catch (error) {
      console.error('Failed to create newsletter on server, creating locally:', error);
      
      // Fallback to local creation
      const newNewsletter: Newsletter = {
        id: Date.now().toString(),
        title: title.trim(),
        subtitle: '',
        date: dateString,
        readOnlineUrl: '',
        content: '',
        events: [],
        startDate: '',
        endDate: '',
        createdAt: new Date(),
        publishedAt: null,
        isPublished: false,
        isAdminOnly: true,
      };

      const updatedNewsletters = [...newsletters, newNewsletter];
      setNewsletters(updatedNewsletters);
      await saveNewsletters(updatedNewsletters);

      return newNewsletter;
    }
  };

  const updateNewsletter = async (id: string, updates: Partial<Newsletter>) => {
    if (!isAdmin) {
      throw new Error('Only admins can update newsletters');
    }

    try {
      await ApiService.updateNewsletter(id, updates);
    } catch (error) {
      console.error('Failed to update newsletter on server, updating locally:', error);
    }

    const updatedNewsletters = newsletters.map(newsletter =>
      newsletter.id === id ? { ...newsletter, ...updates } : newsletter
    );

    setNewsletters(updatedNewsletters);
    await saveNewsletters(updatedNewsletters);

    // Update current newsletter if it's the one being updated
    if (currentNewsletter && currentNewsletter.id === id) {
      setCurrentNewsletter({ ...currentNewsletter, ...updates });
    }
  };

  const publishNewsletter = async (id: string) => {
    if (!isAdmin) {
      throw new Error('Only admins can publish newsletters');
    }

    try {
      await ApiService.publishNewsletter(id);
    } catch (error) {
      console.error('Failed to publish newsletter on server:', error);
    }

    await updateNewsletter(id, {
      isPublished: true,
      publishedAt: new Date(),
    });

    // Here you would typically send push notifications
    // For now, we'll just log it
  };

  const deleteNewsletter = async (id: string) => {
    if (!isAdmin) {
      throw new Error('Only admins can delete newsletters');
    }

    try {
      await ApiService.deleteNewsletter(id);
    } catch (error) {
      console.error('Failed to delete newsletter on server:', error);
    }

    const updatedNewsletters = newsletters.filter(newsletter => newsletter.id !== id);
    setNewsletters(updatedNewsletters);
    await saveNewsletters(updatedNewsletters);

    if (currentNewsletter && currentNewsletter.id === id) {
      setCurrentNewsletter(null);
    }
  };

  const value: NewsletterContextType = {
    newsletters,
    currentNewsletter,
    setCurrentNewsletter,
    createNewsletter,
    updateNewsletter,
    publishNewsletter,
    deleteNewsletter,
    loadNewsletters,
    isAdmin,
  };

  return (
    <NewsletterContext.Provider value={value}>
      {children}
    </NewsletterContext.Provider>
  );
};