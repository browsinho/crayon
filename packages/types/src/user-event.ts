import { z } from "zod";

export const EventTargetSchema = z.object({
  nodeId: z.string().optional(),
  selector: z.string(),
  tagName: z.string(),
  className: z.string().optional(),
  id: z.string().optional(),
  textContent: z.string().optional(),
});
export type EventTarget = z.infer<typeof EventTargetSchema>;

export const ViewportPositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});
export type ViewportPosition = z.infer<typeof ViewportPositionSchema>;

export const ModifiersSchema = z.object({
  ctrl: z.boolean(),
  shift: z.boolean(),
  alt: z.boolean(),
  meta: z.boolean(),
});
export type Modifiers = z.infer<typeof ModifiersSchema>;

const UserEventBaseSchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  target: EventTargetSchema,
  viewport: ViewportPositionSchema,
});

export const ClickEventSchema = UserEventBaseSchema.extend({
  type: z.literal("click"),
  button: z.enum(["left", "middle", "right"]),
  clickCount: z.number(),
  modifiers: ModifiersSchema,
});
export type ClickEvent = z.infer<typeof ClickEventSchema>;

export const InputEventSchema = UserEventBaseSchema.extend({
  type: z.literal("input"),
  inputType: z.enum([
    "text",
    "password",
    "email",
    "number",
    "checkbox",
    "radio",
    "select",
    "textarea",
    "other",
  ]),
  value: z.string().optional(),
  previousValue: z.string().optional(),
});
export type InputEvent = z.infer<typeof InputEventSchema>;

export const ScrollEventSchema = UserEventBaseSchema.extend({
  type: z.literal("scroll"),
  scrollTop: z.number(),
  scrollLeft: z.number(),
  scrollHeight: z.number(),
  scrollWidth: z.number(),
  direction: z.enum(["up", "down", "left", "right"]),
});
export type ScrollEvent = z.infer<typeof ScrollEventSchema>;

export const KeyboardEventSchema = UserEventBaseSchema.extend({
  type: z.literal("keyboard"),
  key: z.string(),
  code: z.string(),
  modifiers: ModifiersSchema,
});
export type KeyboardEvent = z.infer<typeof KeyboardEventSchema>;

export const FocusEventSchema = UserEventBaseSchema.extend({
  type: z.literal("focus"),
  focusType: z.enum(["focus", "blur"]),
});
export type FocusEvent = z.infer<typeof FocusEventSchema>;

export const HoverEventSchema = UserEventBaseSchema.extend({
  type: z.literal("hover"),
  duration: z.number().optional(),
});
export type HoverEvent = z.infer<typeof HoverEventSchema>;

export const UserEventSchema = z.discriminatedUnion("type", [
  ClickEventSchema,
  InputEventSchema,
  ScrollEventSchema,
  KeyboardEventSchema,
  FocusEventSchema,
  HoverEventSchema,
]);
export type UserEvent = z.infer<typeof UserEventSchema>;

export const UserEventTypeSchema = z.enum([
  "click",
  "input",
  "scroll",
  "keyboard",
  "focus",
  "hover",
]);
export type UserEventType = z.infer<typeof UserEventTypeSchema>;
