export interface Newsletter {
  id: string;
  title: string; // Large main title
  subtitle?: string; // Optional subtitle under main title
  date: string; // Display date
  readOnlineUrl?: string; // Optional "Read Online" link
  content: string; // Rich text content as HTML-like string
  events: NewsletterEvent[]; // Embedded events for the newsletter
  startDate?: string; // Date range start for event generation
  endDate?: string; // Date range end for event generation
  blocks?: string; // JSON string of blocks for block-based editing
  sections?: string; // JSON string of structured sections
  createdAt: Date;
  publishedAt: Date | null;
  isPublished: boolean;
  isAdminOnly: boolean; // Only admin can create/edit
}

export interface NewsletterEvent {
  id: string; // Unique ID for the newsletter event block
  originalEventId?: number; // Reference to original event if auto-generated
  title: string;
  description: string;
  time: string;
  location: string;
  date: string; // Day format like "Thursday – 8/14"
  isEditable: boolean; // Whether admin can edit this event
}

// For future rich text formatting
export interface TextFormat {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  size?: 'small' | 'normal' | 'large' | 'xlarge';
}

export interface NewsletterContextType {
  newsletters: Newsletter[];
  currentNewsletter: Newsletter | null;
  setCurrentNewsletter: (newsletter: Newsletter | null) => void;
  createNewsletter: (title: string) => Promise<Newsletter>;
  updateNewsletter: (id: string, updates: Partial<Newsletter>) => Promise<void>;
  publishNewsletter: (id: string) => Promise<void>;
  deleteNewsletter: (id: string) => Promise<void>;
  loadNewsletters: () => Promise<void>;
  isAdmin: boolean;
  adminLoading: boolean;
}