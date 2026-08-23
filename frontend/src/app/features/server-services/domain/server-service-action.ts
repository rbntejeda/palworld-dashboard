export type ServerServiceActionId = 'start' | 'restart' | 'stop';

export interface ServerServiceAction {
  id: ServerServiceActionId;
  label: string;
  tone: ServerServiceActionId;
}

export const SERVER_SERVICE_ACTIONS: ServerServiceAction[] = [
  {
    id: 'start',
    label: 'Iniciar',
    tone: 'start'
  },
  {
    id: 'restart',
    label: 'Reiniciar',
    tone: 'restart'
  },
  {
    id: 'stop',
    label: 'Detener',
    tone: 'stop'
  }
];
