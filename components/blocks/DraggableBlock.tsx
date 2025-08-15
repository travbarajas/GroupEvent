import React from 'react';
import { TouchableOpacity } from 'react-native';
import {
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import {
  NewsletterBlock,
  HeadingBlock,
  ParagraphBlock,
  ContentBreakBlock,
  ImageBlock,
  ButtonBlock,
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
  isDragging: boolean;
  dragY: Animated.SharedValue<number>;
  draggedBlockIndex: Animated.SharedValue<number>;
  onUpdate: (block: NewsletterBlock) => void;
  onDelete: () => void;
  onDragStart: () => void;
  onEdit: () => void;
  onStopEditing: () => void;
  onSelect: () => void;
  gestureHandler: any;
}

export default function DraggableBlock({
  block,
  index,
  isSelected,
  isEditing,
  isDragging,
  dragY,
  draggedBlockIndex,
  onUpdate,
  onDelete,
  onDragStart,
  onEdit,
  onStopEditing,
  onSelect,
  gestureHandler,
}: DraggableBlockProps) {
  
  const animatedStyle = useAnimatedStyle(() => {
    const isBeingDragged = draggedBlockIndex.value === index;
    return {
      transform: [
        { translateY: isBeingDragged ? dragY.value : 0 },
        { scale: isBeingDragged ? 1.02 : 1 }
      ],
      zIndex: isBeingDragged ? 1000 : 1,
      opacity: isBeingDragged ? 0.9 : 1,
    };
  });

  const blockProps = {
    block,
    isSelected,
    isEditing,
    onUpdate,
    onDelete,
    onDragStart,
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
    <PanGestureHandler onGestureEvent={gestureHandler}>
      <Animated.View style={animatedStyle}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={onSelect}
        >
          <BlockComponent {...blockProps} />
        </TouchableOpacity>
      </Animated.View>
    </PanGestureHandler>
  );
}