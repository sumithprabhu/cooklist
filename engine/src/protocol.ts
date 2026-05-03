/**
 * The API contract between the engine and every platform adapter.
 * Adapters translate platform-native formats into these shapes and back.
 */

import { z } from "zod";

// ── Inbound ──────────────────────────────────────────────────────────────────

export const PlatformSchema = z.enum(["telegram", "whatsapp", "slack", "web"]);
export type Platform = z.infer<typeof PlatformSchema>;

export const MessageInputSchema = z.object({
  session_id: z.string().min(1),
  platform: PlatformSchema,
  user_id: z.string().min(1),
  /** Text the user typed */
  text: z.string().optional(),
  /** ID of a button the user tapped, e.g. "order", "set_servings:4" */
  action_id: z.string().optional(),
}).refine(
  (d) => d.text !== undefined || d.action_id !== undefined,
  { message: "Provide either text or action_id" }
);

export type MessageInput = z.infer<typeof MessageInputSchema>;

// ── Outbound ─────────────────────────────────────────────────────────────────

export interface Action {
  id: string;
  label: string;
}

export interface MessageOutput {
  text: string;
  /** Rows of buttons — adapters translate to platform-native UI */
  action_rows: Action[][];
  /** Opaque state persisted by the engine between turns */
  state: ConversationState;
}

// ── Session state ─────────────────────────────────────────────────────────────

export type ConversationStep =
  | "idle"
  | "recipe_shown"
  | "awaiting_servings"
  | "awaiting_auth"     // user must complete Swiggy OAuth before ordering
  | "order_preview"     // cart built, showing total, awaiting confirm
  | "ordered";

export interface ConversationState {
  step: ConversationStep;
  recipe_key?: string;
  servings?: number;
  address_id?: string;
  cart_total?: number;
  order_id?: string;
}

export const INITIAL_STATE: ConversationState = { step: "idle" };
