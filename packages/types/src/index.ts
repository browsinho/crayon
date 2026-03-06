// Browser types
export {
  BrowserSessionSchema,
  BrowserSessionStatusSchema,
  ViewportSchema,
  type BrowserSession,
  type BrowserSessionStatus,
  type Viewport,
} from "./browser.js";

// DOM types
export {
  DOMSnapshotSchema,
  DOMSnapshotTypeSchema,
  MutationSchema,
  type DOMSnapshot,
  type DOMSnapshotType,
  type Mutation,
} from "./dom.js";

// Network types
export {
  NetworkCallSchema,
  NetworkRequestSchema,
  NetworkResponseSchema,
  type NetworkCall,
  type NetworkRequest,
  type NetworkResponse,
} from "./network.js";

// Screenshot types
export { ScreenshotSchema, type Screenshot } from "./screenshot.js";

// Recording types
export {
  RecordingMetadataSchema,
  RecordingMetadataV2Schema,
  RecordingSchema,
  RecordingStatsSchema,
  RecordingStatsV2Schema,
  RecordingStatusSchema,
  RecordingV2Schema,
  type Recording,
  type RecordingMetadata,
  type RecordingMetadataV2,
  type RecordingStats,
  type RecordingStatsV2,
  type RecordingStatus,
  type RecordingV2,
} from "./recording.js";

// User event types
export {
  ClickEventSchema,
  EventTargetSchema,
  FocusEventSchema,
  HoverEventSchema,
  InputEventSchema,
  KeyboardEventSchema,
  ModifiersSchema,
  ScrollEventSchema,
  UserEventSchema,
  UserEventTypeSchema,
  ViewportPositionSchema,
  type ClickEvent,
  type EventTarget,
  type FocusEvent,
  type HoverEvent,
  type InputEvent,
  type KeyboardEvent,
  type Modifiers,
  type ScrollEvent,
  type UserEvent,
  type UserEventType,
  type ViewportPosition,
} from "./user-event.js";

// Event correlation types
export {
  AffectedAreaSchema,
  BoundingBoxSchema,
  CorrelatedEventGroupSchema,
  CorrelationMetricsSchema,
  UIStateChangeTypeSchema,
  type AffectedArea,
  type BoundingBox,
  type CorrelatedEventGroup,
  type CorrelationMetrics,
  type UIStateChangeType,
} from "./event-correlation.js";

// Page types
export {
  PageEntryTriggerSchema,
  PageEntryTypeSchema,
  PageSchema,
  PageTypeSchema,
  type Page,
  type PageEntryTrigger,
  type PageEntryType,
  type PageType,
} from "./page.js";

// Framework types
export {
  FrameworkInfoSchema,
  FrameworkTypeSchema,
  type FrameworkInfo,
  type FrameworkType,
} from "./framework.js";

// API types
export {
  APIRouteExampleSchema,
  APIRoutePatternSchema,
  APIRouteSchema,
  type APIRoute,
  type APIRouteExample,
  type APIRoutePattern,
} from "./api.js";

// Schema types
export {
  DataSchemaSchema,
  FieldFormatSchema,
  FieldSchemaSchema,
  FieldTypeSchema,
  RelationshipSchema,
  type DataSchema,
  type FieldFormat,
  type FieldSchema,
  type FieldType,
  type Relationship,
} from "./schema.js";

// Auth types
export {
  AuthInfoSchema,
  AuthTypeSchema,
  FormAuthSchema,
  OAuthInfoSchema,
  OAuthProviderSchema,
  TokenAuthSchema,
  TokenStorageSchema,
  type AuthInfo,
  type AuthType,
  type FormAuth,
  type OAuthInfo,
  type OAuthProvider,
  type TokenAuth,
  type TokenStorage,
} from "./auth.js";

// Sandbox types
export {
  SandboxHostSchema,
  SandboxPortsSchema,
  SandboxSchema,
  SandboxStatusSchema,
  type Sandbox,
  type SandboxHost,
  type SandboxPorts,
  type SandboxStatus,
} from "./sandbox.js";

// Checkpoint types
export {
  BrowserStateSchema,
  CheckpointSchema,
  CookieSchema,
  type BrowserState,
  type Checkpoint,
  type Cookie,
} from "./checkpoint.js";

// Widget types
export {
  WidgetInfoSchema,
  WidgetTypeSchema,
  type WidgetInfo,
  type WidgetType,
} from "./widget.js";

// Page metadata types
export {
  HeadingSchema,
  NavLinkSchema,
  OpenGraphSchema,
  PageMetadataSchema,
  TwitterCardSchema,
  type Heading,
  type NavLink,
  type OpenGraph,
  type PageMetadata,
  type TwitterCard,
} from "./page-metadata.js";

// Project types
export {
  CreateProjectDataSchema,
  ProjectListFiltersSchema,
  ProjectSchema,
  ProjectSortFieldSchema,
  ProjectSortOrderSchema,
  ProjectSortSchema,
  ProjectStatusSchema,
  UpdateProjectDataSchema,
  type CreateProjectData,
  type Project,
  type ProjectListFilters,
  type ProjectSort,
  type ProjectSortField,
  type ProjectSortOrder,
  type ProjectStatus,
  type UpdateProjectData,
} from "./project.js";

// Summary types
export {
  BrandStyleSchema,
  ComponentSummarySchema,
  InteractionSummarySchema,
  PageSummarySchema,
  RecordingSummarySchema,
  type BrandStyle,
  type ComponentSummary,
  type InteractionSummary,
  type PageSummary,
  type RecordingSummary,
} from "./summary.js";
