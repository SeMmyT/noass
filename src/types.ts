// ── types.ts — Shared type definitions ──────────────────────────────────────

export interface PaneData {
  idx: number;
  name: string;
  alive: boolean;
  ctx_k: number;
  last: string;
  rate_k_per_min: number;
  eta_800k_min: number | null;
  ctx_pct: number;
}

export interface StateMessage {
  type: "state";
  panes: PaneData[];
  log: LogEntry[];
  stats: Stats;
}

export interface ReadResultMessage {
  type: "readResult";
  target: string;
  content: string;
}

export interface AckMessage {
  type: "ack";
  command: string;
  target: string;
  success: boolean;
}

export type ServerMessage = StateMessage | ReadResultMessage | AckMessage;

export interface LogEntry {
  event: string;
  name: string;
  timestamp: number;
  detail?: string;
  // server.js sometimes uses these alternate keys
  action?: string;
  target?: string;
  ts?: number;
}

export interface Stats {
  total_panes: number;
  alive: number;
  dead: number;
  total_ctx_k: number;
  uptime_sec: number;
}

export interface GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  targetRadius: number;
  pane: PaneData;
}

export interface Skin {
  id: string;
  name: string;
  author: string;
  version: string;
  description: string;
  preview?: string;
  accent: string;
  accentRGB: { r: number; g: number; b: number };
  nodeAliveGray: number;
  nodeDeadGray: number;
  bgColor: string;
  scanlineOpacity: number;
  scanlineGap: number;
  vignetteStrength: number;
  crtCurvature: boolean;
  pulseHz: number;
  pulseAmp: number;
  fontFamily: string;
  connectionStyle: "stippled" | "solid" | "dashed";
  connectionGap: number;
}

export interface AppState {
  ws: WebSocket | null;
  state: StateMessage | null;
  prevState: StateMessage | null;
  skin: Skin;
  nodes: GraphNode[];
  selectedNode: GraphNode | null;
  showContextMenu: boolean;
  contextMenuPos: { x: number; y: number };
  paused: boolean;
  time: number;
  lastDataTime: number;
  width: number;
  height: number;
  isMobile: boolean;
  dpr: number;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  _mouseX: number;
  _mouseY: number;
}
