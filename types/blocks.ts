// Block-based newsletter content types
export type BlockType = 
  | 'heading-1'
  | 'heading-2' 
  | 'heading-3'
  | 'heading-4'
  | 'paragraph'
  | 'content-break'
  | 'image'
  | 'button'
  | 'event-list';

export interface BaseBlock {
  id: string;
  type: BlockType;
  order: number;
}

export interface HeadingBlock extends BaseBlock {
  type: 'heading-1' | 'heading-2' | 'heading-3' | 'heading-4';
  content: string;
  alignment?: 'left' | 'center' | 'right';
}

export interface ParagraphBlock extends BaseBlock {
  type: 'paragraph';
  content: string;
  alignment?: 'left' | 'center' | 'right';
  // Rich text formatting will be handled in content as markdown/html
}

export interface ContentBreakBlock extends BaseBlock {
  type: 'content-break';
  style?: 'line' | 'dots' | 'space' | 'stars';
}

export interface ImageBlock extends BaseBlock {
  type: 'image';
  src: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
  alignment?: 'left' | 'center' | 'right';
}

export interface ButtonBlock extends BaseBlock {
  type: 'button';
  text: string;
  url: string;
  style?: 'primary' | 'secondary' | 'outline';
  alignment?: 'left' | 'center' | 'right';
}

export interface EventListBlock extends BaseBlock {
  type: 'event-list';
  title?: string;
  events: string[]; // Array of event IDs
  showDate?: boolean;
  showLocation?: boolean;
  showDescription?: boolean;
}

export type NewsletterBlock = 
  | HeadingBlock 
  | ParagraphBlock 
  | ContentBreakBlock 
  | ImageBlock 
  | ButtonBlock 
  | EventListBlock;

// Enhanced newsletter interface with blocks
export interface BlockBasedNewsletter {
  id: string;
  title: string;
  subtitle?: string;
  date: string;
  readOnlineUrl?: string;
  
  // Block-based content instead of plain content string
  blocks: NewsletterBlock[];
  
  // Keep events for backward compatibility and event management
  events: NewsletterEvent[];
  
  startDate?: string;
  endDate?: string;
  createdAt: Date;
  publishedAt: Date | null;
  isPublished: boolean;
  isAdminOnly: boolean;
}

// Helper functions for block manipulation
export const createBlock = (type: BlockType, order: number): NewsletterBlock => {
  const baseId = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  switch (type) {
    case 'heading-1':
    case 'heading-2':
    case 'heading-3':
    case 'heading-4':
      return {
        id: baseId,
        type,
        order,
        content: '',
        alignment: 'left'
      } as HeadingBlock;
      
    case 'paragraph':
      return {
        id: baseId,
        type,
        order,
        content: '',
        alignment: 'left'
      } as ParagraphBlock;
      
    case 'content-break':
      return {
        id: baseId,
        type,
        order,
        style: 'line'
      } as ContentBreakBlock;
      
    case 'image':
      return {
        id: baseId,
        type,
        order,
        src: '',
        alt: '',
        alignment: 'center'
      } as ImageBlock;
      
    case 'button':
      return {
        id: baseId,
        type,
        order,
        text: '',
        url: '',
        style: 'primary',
        alignment: 'center'
      } as ButtonBlock;
      
    case 'event-list':
      return {
        id: baseId,
        type,
        order,
        title: 'Events',
        events: [],
        showDate: true,
        showLocation: true,
        showDescription: true
      } as EventListBlock;
      
    default:
      throw new Error(`Unknown block type: ${type}`);
  }
};

export const reorderBlocks = (blocks: NewsletterBlock[], fromIndex: number, toIndex: number): NewsletterBlock[] => {
  const reorderedBlocks = [...blocks];
  const [removed] = reorderedBlocks.splice(fromIndex, 1);
  reorderedBlocks.splice(toIndex, 0, removed);
  
  // Update order properties
  return reorderedBlocks.map((block, index) => ({
    ...block,
    order: index
  }));
};

// Import NewsletterEvent for backward compatibility
import { NewsletterEvent } from './newsletter';