import { supabase } from "@/integrations/supabase/client";

export type AuditActorRole = "client" | "accountant" | "system";
export type AuditEntityType =
  | "transaction"
  | "category"
  | "journal_entry"
  | "vat_rate"
  | "filing"
  | "correction";
export type AuditAction = "create" | "update" | "delete" | "approve" | "reverse";

export interface AuditEventInput {
  userId: string;
  actorId: string;
  actorRole: AuditActorRole;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditEvent {
  id: string;
  user_id: string;
  actor_id: string;
  actor_role: AuditActorRole;
  entity_type: AuditEntityType;
  entity_id: string;
  action: AuditAction;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/**
 * Log an audit event — fire-and-forget insert to audit_trail.
 * Errors are swallowed and logged to console so they never block the caller.
 */
export function logAuditEvent(input: AuditEventInput): void {
  supabase
    .from("audit_trail")
    .insert({
      user_id: input.userId,
      actor_id: input.actorId,
      actor_role: input.actorRole,
      entity_type: input.entityType,
      entity_id: input.entityId,
      action: input.action,
      field_name: input.fieldName ?? null,
      old_value: input.oldValue ?? null,
      new_value: input.newValue ?? null,
      metadata: input.metadata ?? {},
    })
    .then(({ error }) => {
      if (error) {
        console.error("[AuditTrail] Failed to log event:", error.message, input);
      }
    });
}
