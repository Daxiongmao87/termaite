export interface CLIOptions {
  mode: 'normal' | 'gremlin' | 'goblin';
  config?: string;
  verbose?: boolean;
  color: boolean;
  debug?: boolean;
}

export interface AppProps {
  task?: string;
  options: CLIOptions;
  onExit: () => void;
}

export interface TaskState {
  status: 'idle' | 'planning' | 'acting' | 'evaluating' | 'completed' | 'failed';
  currentAgent: 'plan' | 'action' | 'evaluation' | null;
  progress: number;
  message: string;
}

export interface StreamEvent {
  type: 'agent_start' | 'agent_thinking' | 'agent_response' | 'command_start' | 'command_output' | 'command_complete' | 'error';
  agent?: 'plan' | 'action' | 'evaluation';
  data: any;
  timestamp: number;
}

export interface UIState {
  isLoading: boolean;
  showInput: boolean;
  messages: StreamEvent[];
  currentTask: string | null;
  error: string | null;
}
