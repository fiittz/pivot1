import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Camera, Receipt, FileText, X } from "lucide-react";

export default function MobileQuickActions() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const actions = [
    { icon: Camera, label: "Scan Receipt", path: "/scanner", color: "bg-blue-500" },
    { icon: Receipt, label: "Add Expense", path: "/expense", color: "bg-green-500" },
    { icon: FileText, label: "New Invoice", path: "/invoices/new", color: "bg-purple-500" },
  ];

  return (
    <div className="fixed bottom-24 right-4 z-40 md:hidden">
      {/* Action buttons */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30" onClick={() => setIsOpen(false)} />

          {/* Actions */}
          <div className="absolute bottom-16 right-0 flex flex-col gap-3 z-40">
            {actions.map((action, i) => (
              <button
                key={action.label}
                onClick={() => { navigate(action.path); setIsOpen(false); }}
                className="flex items-center gap-3 animate-fade-in"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <span className="text-sm font-medium text-white bg-black/70 px-3 py-1.5 rounded-lg whitespace-nowrap">
                  {action.label}
                </span>
                <div className={`w-12 h-12 rounded-full ${action.color} flex items-center justify-center shadow-lg`}>
                  <action.icon className="w-5 h-5 text-white" />
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* FAB */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative z-40 w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-lg transition-transform ${isOpen ? "rotate-45" : ""}`}
      >
        {isOpen ? (
          <X className="w-6 h-6 text-primary-foreground" />
        ) : (
          <Plus className="w-6 h-6 text-primary-foreground" />
        )}
      </button>
    </div>
  );
}
