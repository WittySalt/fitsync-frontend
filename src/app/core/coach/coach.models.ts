/**
 * Types for the coach, mirroring the recommendation-service contracts field for field.
 *
 * Nothing here is derived or renamed. A frontend type that "tidies up" a backend field is a second
 * place for the contract to live, and the two drift; when they do, the symptom is a card that shows
 * a value that was true when the type was written. The field names below are the wire names.
 */

export type RecommendationSource = 'RULE' | 'AI';

/** One insight the rule engine or the narrative model produced, with the facts it came from. */
export interface Recommendation {
  type: string;
  source: RecommendationSource;
  facts: Record<string, unknown>;
  narrative: string;
  generatedAt: string;
  expiresAt: string | null;
}

export interface CoachThread {
  threadId: string;
  title: string | null;
  turnCount: number;
  lastActiveAt: string;
  createdAt: string;
}

/** One row of the conversation history list. */
export interface CoachThreadSummary {
  threadId: string;
  title: string | null;
  /** The page the conversation was started from, or null when the server did not say. */
  surface: CoachSurfaceCode | null;
  lastMessageAt: string | null;
  turnCount: number;
}

/** One page of the history list. `hasMore` is derived from whichever paging fields the server sent. */
export interface CoachThreadPage {
  items: CoachThreadSummary[];
  page: number;
  hasMore: boolean;
}

/** The server's answer when a user has asked more often than the coach allows. */
export interface CoachLimit {
  message: string;
  retryAfterSeconds: number;
}

export interface ToolInvocation {
  seq: number;
  tool: string;
  args: string;
  resultSummary: string | null;
  latencyMs: number;
  ok: boolean;
  error: string | null;
}

export type CoachTurnRole = 'USER' | 'ASSISTANT' | 'TOOL';

export interface CoachTurn {
  turnId: string;
  seq: number;
  role: CoachTurnRole;
  content: string;
  tier: number | null;
  model: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  latencyMs: number | null;
  guardrailVerdict: string | null;
  tools: ToolInvocation[];
  createdAt: string;
}

export interface CoachThreadDetail {
  thread: CoachThread;
  turns: CoachTurn[];
}

/** Which page a question is asked from, and optionally which reading it is about. */
export type CoachSurfaceCode = 'HOME' | 'WORKOUT' | 'NUTRITION' | 'PROGRESS' | 'PROFILE';

/** Sent with a question so the server can ground its answer without the client resending facts. */
export interface CoachMessageContext {
  surface: CoachSurfaceCode;
  readingId?: string;
  /** The recipe a question is about, when it was asked from a recipe page. */
  recipeId?: string;
  timezone?: string;
}

/** The answer the plain endpoint returns, and the payload of the stream's final `answer` event. */
export interface CoachMessageResponse {
  threadId: string;
  turnId: string;
  answer: string;
  tier: number;
  toolsUsed: string[];
  latencyMs: number;
  /** The reading the server grounded this answer in, or null when none was pinned or found. */
  pinnedReadingId: string | null;
}

/** What the coach reports while a turn is still running. Names are the SSE event names. */
export type CoachProgressKind = 'TOOL_STARTED' | 'TOOL_FINISHED' | 'THINKING';

export interface CoachProgressEvent {
  kind: CoachProgressKind;
  tool: string | null;
  summary: string | null;
  latencyMs: number | null;
}

export type CoachStreamEvent =
  | { name: 'tool_started' | 'tool_finished' | 'thinking'; data: CoachProgressEvent }
  | { name: 'answer'; data: CoachMessageResponse }
  | { name: 'error'; data: string };

export type ArtifactStatus = 'DRAFT' | 'ACCEPTED' | 'DISCARDED';
export type DraftSource = 'MODEL' | 'MODEL_REPAIRED' | 'RULE_FALLBACK';

export interface DraftExercise {
  exerciseId: string;
  name: string;
  sets: number;
  reps: number | null;
  seconds: number | null;
  restSeconds: number;
  rationale: string;
}

export interface SessionDraft {
  title: string;
  focus: string[];
  estimatedMinutes: number;
  exercises: DraftExercise[];
  summary: string;
}

/** One finding the validator attached to a draft, when the server sends any. */
export interface DraftFinding {
  label: string;
  /** False marks a rule the draft was corrected for; absent means it passed. */
  passed: boolean;
}

export interface SessionDraftView {
  artifactId: string;
  status: ArtifactStatus;
  source: DraftSource;
  validationAttempts: number;
  session: SessionDraft;
  planId: string | null;
  sessionId: string | null;
  rejectionReason: string | null;
  /** Not sent by every server version; the page falls back to what the draft's source guarantees. */
  findings?: DraftFinding[] | null;
}

export interface AcceptSessionDraftResponse {
  artifactId: string;
  status: ArtifactStatus;
  planId: string;
  sessionId: string | null;
  sessionStarted: boolean;
}

export interface DraftMetrics {
  total: number;
  model: number;
  modelRepaired: number;
  ruleFallback: number;
  modelSuccessRate: number;
  firstPassRate: number;
  repairRate: number;
}

/** The tier that answered, as the trace shows it. -1 means the AI tier was switched off. */
export function tierLabel(tier: number | null | undefined): string {
  switch (tier) {
    case 0:
      return 'rule';
    case 1:
      return 'template';
    case 2:
      return 'local model';
    case 3:
      return 'frontier model';
    case -1:
      return 'model off';
    default:
      return 'unknown';
  }
}

/** Which page a reading belongs to. Only the Workout page has one so far. */
export type ReadingSurface = 'WORKOUT' | 'NUTRITION' | 'PROGRESS';

/**
 * Where a reading stands. READY carries a reading. WRITING means the model is at work and the
 * client asks again shortly. RESTING means the facts are shown without a reading. EMPTY means
 * there is nothing to show yet.
 */
export type ReadingStatus = 'READY' | 'WRITING' | 'RESTING' | 'EMPTY';

export interface ReadingFact {
  number: number;
  key: string;
  label: string;
  value: string;
  unit: string;
  numericValue: number | null;
  note: string;
  detail: string;
}

export interface CoachReadingText {
  headline: string;
  body: string;
  citations: number[];
  source: string;
  generatedAt: string | null;
}

export interface LiftProgress {
  exerciseName: string;
  fromKg: number;
  fromDate: string;
  toKg: number;
  toDate: string;
}

export interface CoachReading {
  surface: ReadingSurface;
  status: ReadingStatus;
  readingId: string | null;
  period: 'THIS_WEEK' | 'PREVIOUS_WEEK' | 'LAST_28_DAYS' | 'NONE';
  periodStart: string | null;
  periodEnd: string | null;
  facts: ReadingFact[];
  reading: CoachReadingText | null;
  lifts: LiftProgress[];
}
