export type MessageType = 'success' | 'error' | 'info';

export interface PermissionMessage {
  text: string;
  type: MessageType;
}

export interface PermissionItem {
  origin: string;
  granted: boolean;
}

