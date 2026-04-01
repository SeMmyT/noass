export const AgentState = {
  IDLE: "idle",
  THINKING: "thinking",
  TOOL_CALL: "tool_call",
  AWAITING_INPUT: "awaiting_input",
  ERROR: "error",
  COMPLETE: "complete",
} as const;

export type AgentStateValue = (typeof AgentState)[keyof typeof AgentState];

export interface HookEvent {
  hook_event_name?: string;
  event_name: string;
  session_id: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  notification_type?: string;
  message?: string;
  agent_id?: string;
  agent_type?: string;
  stop_hook_active?: boolean;
  last_assistant_message?: string;
  custom_label?: string;
}

export interface SubAgent {
  agent_id: string;
  agent_type: string;
  status: "running" | "completed";
  name: string;
}

export interface SessionState {
  session_id: string;
  status: AgentStateValue;
  previous_status: AgentStateValue | null;
  tool: string | null;
  tool_input_summary: string;
  message: string;
  event: string;
  label: string;
  sub_agents: SubAgent[];
  ts: string;
  context_percent: number | null;
  cost_usd: number | null;
  model: string | null;
  cwd: string | null;
}

export function parseHookEvent(raw: Record<string, unknown>): HookEvent {
  return {
    event_name: (raw.hook_event_name ?? raw.event_name ?? "") as string,
    session_id: (raw.session_id ?? "") as string,
    tool_name: raw.tool_name as string | undefined,
    tool_input: raw.tool_input as Record<string, unknown> | undefined,
    notification_type: raw.notification_type as string | undefined,
    message: raw.message as string | undefined,
    agent_id: raw.agent_id as string | undefined,
    agent_type: raw.agent_type as string | undefined,
    stop_hook_active: raw.stop_hook_active as boolean | undefined,
    last_assistant_message: raw.last_assistant_message as string | undefined,
    custom_label: raw.custom_label as string | undefined,
  };
}

export function deriveStatus(event: HookEvent): AgentStateValue {
  switch (event.event_name) {
    case "PreToolUse":
      return AgentState.TOOL_CALL;
    case "PostToolUse":
      return AgentState.THINKING;
    case "PostToolUseFailure":
      return AgentState.ERROR;
    case "Stop":
      return event.stop_hook_active ? AgentState.AWAITING_INPUT : AgentState.COMPLETE;
    case "SessionEnd":
    case "TaskCompleted":
      return AgentState.COMPLETE;
    case "UserPromptSubmit":
      return AgentState.THINKING;
    case "Notification":
      return (event.notification_type === "permission_prompt" || event.notification_type === "idle_prompt")
        ? AgentState.AWAITING_INPUT
        : AgentState.THINKING;
    case "PermissionRequest":
      return AgentState.AWAITING_INPUT;
    case "SubagentStart":
    case "SubagentStop":
      return AgentState.THINKING;
    case "SessionStart":
    case "TeammateIdle":
      return AgentState.IDLE;
    default:
      return AgentState.THINKING;
  }
}

export function summarizeToolInput(input: Record<string, unknown>): string {
  const s = (input.command ?? input.file_path ?? JSON.stringify(input)) as string;
  return s.slice(0, 128);
}

export function isAlive(status: AgentStateValue): boolean {
  return status !== AgentState.COMPLETE;
}
