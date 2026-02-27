import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useClientNotes, useCreateNote, useUpdateNote, useDeleteNote } from "@/hooks/accountant/useClientNotes";
import { ClientNoteEditor } from "@/components/accountant/ClientNoteEditor";
import type { ClientNote } from "@/types/accountant";
import { Plus, Pin, PinOff, Pencil, Trash2, StickyNote } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ClientNotesTabProps {
  accountantClientId: string;
}

const ClientNotesTab = ({ accountantClientId }: ClientNotesTabProps) => {
  const { data: notes = [], isLoading } = useClientNotes(accountantClientId);
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const { toast } = useToast();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<ClientNote | null>(null);

  const handleCreate = () => {
    setEditingNote(null);
    setEditorOpen(true);
  };

  const handleEdit = (note: ClientNote) => {
    setEditingNote(note);
    setEditorOpen(true);
  };

  const handleSave = (data: { title: string; content: string }) => {
    if (editingNote) {
      updateNote.mutate(
        { id: editingNote.id, accountant_client_id: accountantClientId, ...data },
        {
          onSuccess: () => {
            setEditorOpen(false);
            toast({ title: "Note updated" });
          },
        },
      );
    } else {
      createNote.mutate(
        { accountant_client_id: accountantClientId, ...data },
        {
          onSuccess: () => {
            setEditorOpen(false);
            toast({ title: "Note created" });
          },
        },
      );
    }
  };

  const handleTogglePin = (note: ClientNote) => {
    updateNote.mutate({
      id: note.id,
      accountant_client_id: accountantClientId,
      is_pinned: !note.is_pinned,
    });
  };

  const handleDelete = (note: ClientNote) => {
    deleteNote.mutate(
      { id: note.id, accountant_client_id: accountantClientId },
      { onSuccess: () => toast({ title: "Note deleted" }) },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          {notes.length} note{notes.length !== 1 ? "s" : ""}
        </h3>
        <Button
          onClick={handleCreate}
          size="sm"
          className="h-8 border border-[#E8930C] bg-[#E8930C]/10 font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest text-[#E8930C] hover:bg-[#E8930C] hover:text-white gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          Note
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading notes...</div>
      ) : notes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <StickyNote className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground text-sm">No notes yet. Add one to keep track of client details.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <Card key={note.id} className={note.is_pinned ? "border-[#E8930C]/30" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {note.is_pinned && <Pin className="w-3.5 h-3.5 text-[#E8930C] shrink-0" />}
                      <h4 className="text-sm font-medium text-foreground truncate">{note.title}</h4>
                    </div>
                    {note.content && (
                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-4">
                        {note.content}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground/60 mt-2">
                      {new Date(note.updated_at).toLocaleDateString("en-IE", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7"
                      onClick={() => handleTogglePin(note)}
                      title={note.is_pinned ? "Unpin" : "Pin"}
                    >
                      {note.is_pinned ? (
                        <PinOff className="w-3.5 h-3.5" />
                      ) : (
                        <Pin className="w-3.5 h-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7"
                      onClick={() => handleEdit(note)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7 text-red-500 hover:text-red-600"
                      onClick={() => handleDelete(note)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ClientNoteEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        note={editingNote}
        onSave={handleSave}
        isSaving={createNote.isPending || updateNote.isPending}
      />
    </div>
  );
};

export default ClientNotesTab;
