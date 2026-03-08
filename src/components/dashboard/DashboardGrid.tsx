import { ReactNode, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, arrayMove } from "@dnd-kit/sortable";

interface DashboardGridProps {
  widgetOrder: string[];
  onReorder: (newOrder: string[]) => void;
  renderWidget: (widgetId: string) => ReactNode;
}

export default function DashboardGrid({ widgetOrder, onReorder, renderWidget }: DashboardGridProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = widgetOrder.indexOf(active.id as string);
    const newIndex = widgetOrder.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;

    onReorder(arrayMove(widgetOrder, oldIndex, newIndex));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={widgetOrder} strategy={rectSortingStrategy}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {widgetOrder.map((id) => renderWidget(id))}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeId ? (
          <div className="opacity-80 rotate-2 scale-105 pointer-events-none">
            {renderWidget(activeId)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
