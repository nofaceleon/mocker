import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { type ReactNode } from 'react';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/cn';

type SortableItem = {
  id: number | string;
};

type SortableListProps<T extends SortableItem> = {
  items: T[];
  onReorder: (orderedIds: Array<T['id']>) => void;
  renderItem: (item: T, index: number) => ReactNode;
  className?: string;
  emptyText?: ReactNode;
};

export function SortableList<T extends SortableItem>({
  items,
  onReorder,
  renderItem,
  className,
  emptyText = '拖动以排序',
}: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((it) => it.id === active.id);
    const newIndex = items.findIndex((it) => it.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(items, oldIndex, newIndex);
    onReorder(reordered.map((it) => it.id));
  };

  if (items.length === 0) {
    return (
      <div
        className={cn(
          'rounded-md border border-dashed border-canvas-muted p-6 text-center text-[12px] text-ink-subtle',
          className,
        )}
      >
        {emptyText}
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((it) => it.id)} strategy={verticalListSortingStrategy}>
        <ul className={cn('space-y-1', className)}>
          {items.map((it, idx) => (
            <SortableRow key={it.id} id={it.id}>
              {renderItem(it, idx)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ id, children }: { id: SortableItem['id']; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <li ref={setNodeRef} style={style} className="flex items-center gap-2">
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab rounded p-1 text-ink-subtle hover:bg-canvas-subtle hover:text-ink active:cursor-grabbing"
        aria-label="拖动排序"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1">{children}</div>
    </li>
  );
}
