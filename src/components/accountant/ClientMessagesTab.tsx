import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import {
  useDirectMessages,
  useSendDirectMessage,
  useMarkMessagesRead,
  useUnreadMessageCount,
} from "@/hooks/accountant/useDirectMessages";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Send, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface ClientMessagesTabProps {
  accountantClientId: string;
}

export default function ClientMessagesTab({ accountantClientId }: ClientMessagesTabProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: messages, isLoading } = useDirectMessages(accountantClientId);
  const sendMessage = useSendDirectMessage();
  const markRead = useMarkMessagesRead();
  const { data: unreadCount } = useUnreadMessageCount(accountantClientId);

  // Mark messages as read on mount
  useEffect(() => {
    if (accountantClientId) {
      markRead.mutate({ accountant_client_id: accountantClientId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountantClientId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Subscribe to Realtime for live updates
  useEffect(() => {
    const channel = supabase
      .channel(`dm-${accountantClientId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `accountant_client_id=eq.${accountantClientId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["direct-messages", accountantClientId] });
          queryClient.invalidateQueries({ queryKey: ["unread-messages"] });
          markRead.mutate({ accountant_client_id: accountantClientId });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountantClientId, queryClient]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;

    sendMessage.mutate({
      accountant_client_id: accountantClientId,
      content: text,
      sender_role: "accountant",
    });
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Messages</CardTitle>
          {unreadCount && unreadCount > 0 ? (
            <Badge variant="destructive" className="text-xs">
              {unreadCount} unread
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="max-h-[400px] pr-2">
            <div className="space-y-2">
              {messages && messages.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No messages yet. Start a conversation with your client.
                </p>
              )}
              {messages?.map((msg) => {
                const isOwn = msg.sender_id === user?.id;
                return (
                  <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                        isOwn ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      <p
                        className={`text-[10px] mt-1 ${
                          isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                        }`}
                      >
                        {format(new Date(msg.created_at), "d MMM, HH:mm")}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        )}

        <div className="border-t pt-3">
          <div className="flex items-center gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              disabled={sendMessage.isPending}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim() || sendMessage.isPending}
              className="shrink-0"
            >
              {sendMessage.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
