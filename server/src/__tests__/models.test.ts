import { describe, it, expect } from "vitest";
import { deriveStatus, AgentState, type HookEvent } from "../models";

describe("deriveStatus", () => {
  it("PreToolUse → TOOL_CALL", () => {
    expect(deriveStatus({ event_name: "PreToolUse" } as HookEvent)).toBe(AgentState.TOOL_CALL);
  });
  it("PostToolUse → THINKING", () => {
    expect(deriveStatus({ event_name: "PostToolUse" } as HookEvent)).toBe(AgentState.THINKING);
  });
  it("PostToolUseFailure → ERROR", () => {
    expect(deriveStatus({ event_name: "PostToolUseFailure" } as HookEvent)).toBe(AgentState.ERROR);
  });
  it("Stop with stop_hook_active → AWAITING_INPUT", () => {
    expect(deriveStatus({ event_name: "Stop", stop_hook_active: true } as HookEvent)).toBe(AgentState.AWAITING_INPUT);
  });
  it("Stop without stop_hook_active → COMPLETE", () => {
    expect(deriveStatus({ event_name: "Stop", stop_hook_active: false } as HookEvent)).toBe(AgentState.COMPLETE);
  });
  it("SessionStart → IDLE", () => {
    expect(deriveStatus({ event_name: "SessionStart" } as HookEvent)).toBe(AgentState.IDLE);
  });
  it("Notification permission_prompt → AWAITING_INPUT", () => {
    expect(deriveStatus({ event_name: "Notification", notification_type: "permission_prompt" } as HookEvent)).toBe(AgentState.AWAITING_INPUT);
  });
  it("PermissionRequest → AWAITING_INPUT", () => {
    expect(deriveStatus({ event_name: "PermissionRequest" } as HookEvent)).toBe(AgentState.AWAITING_INPUT);
  });
  it("unknown event → THINKING", () => {
    expect(deriveStatus({ event_name: "SomethingNew" } as HookEvent)).toBe(AgentState.THINKING);
  });
});
