import { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

interface SortableWidgetProps {
  id: string;
  children: ReactNode;
}

export default function SortableWidget({ id, children }: SortableWidgetProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : "auto" as const,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <button
        className="absolute top-3 right-3 z-10 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-muted transition-all cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </button>
      {children}
    </div>
  );
}
