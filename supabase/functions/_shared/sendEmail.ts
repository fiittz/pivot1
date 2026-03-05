/**
 * Shared email utility using Resend API.
 * Used by receipt-chaser, period-end reminders, and other notification edge functions.
 */

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_ADDRESS = "Balnce <hello@balnce.ie>";

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export async function sendEmail(payload: EmailPayload): Promise<{ success: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    console.warn("[sendEmail] RESEND_API_KEY not configured — email not sent");
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        reply_to: payload.replyTo,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[sendEmail] Resend API error: ${response.status}`, errorText);
      return { success: false, error: errorText };
    }

    return { success: true };
  } catch (err) {
    console.error("[sendEmail] Failed:", err);
    return { success: false, error: String(err) };
  }
}
