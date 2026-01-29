import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import {
  NewsletterBlock,
} from '@/types/blocks';
import {
  HeadingBlockComponent,
  ParagraphBlockComponent,
  ContentBreakBlockComponent,
  ImageBlockComponent,
  ButtonBlockComponent,
  EventListBlockComponent,
} from './BlockComponents';

interface DraggableBlockProps {
  block: NewsletterBlock;
  index: number;
  isSelected: boolean;
  isEditing: boolean;
  onUpdate: (block: NewsletterBlock) => void;
  onDelete: () => void;
  onEdit: () => void;
  onStopEditing: () => void;
  onSelect: () => void;
}

export default function DraggableBlock({
  block,
  index,
  isSelected,
  isEditing,
  onUpdate,
  onDelete,
  onEdit,
  onStopEditing,
  onSelect,
}: DraggableBlockProps) {

  const blockProps = {
    block,
    isSelected,
    isEditing,
    onUpdate,
    onDelete,
    onEdit,
    onStopEditing,
  };

  const getBlockComponent = () => {
    switch (block.type) {
      case 'heading-1':
      case 'heading-2':
      case 'heading-3':
      case 'heading-4':
        return HeadingBlockComponent;
      case 'paragraph':
        return ParagraphBlockComponent;
      case 'content-break':
        return ContentBreakBlockComponent;
      case 'image':
        return ImageBlockComponent;
      case 'button':
        return ButtonBlockComponent;
      case 'event-list':
        return EventListBlockComponent;
      default:
        return ParagraphBlockComponent;
    }
  };

  const BlockComponent = getBlockComponent();

  return (
    <View>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onSelect}
      >
        <BlockComponent {...blockProps} />
      </TouchableOpacity>
    </View>
  );
}