export const INITIAL_SPEAKING_CONVERSATION_STATE = Object.freeze({
  status: 'idle',
  microphone: 'idle',
  transport: 'idle',
  playback: 'idle',
  interrupted: false,
  requestId: null,
  turnSequence: null,
  lastEventSequence: 0,
  error: '',
});

function withDerivedStatus(state) {
  let status = 'idle';
  if (state.error) status = 'error';
  else if (state.microphone === 'transcribing') status = 'transcribing';
  else if (state.microphone === 'listening') status = 'listening';
  else if (state.playback === 'speaking') status = 'speaking';
  else if (state.transport === 'reconnecting') status = 'reconnecting';
  else if (state.transport === 'streaming') status = 'streaming';
  else if (state.transport === 'thinking') status = 'thinking';
  else if (state.interrupted) status = 'interrupted';
  return { ...state, status };
}

export const SPEAKING_STATUS_LABELS = Object.freeze({
  idle: 'Sẵn sàng',
  listening: 'Đang nghe...',
  transcribing: 'Đang nhận giọng nói...',
  thinking: 'Đang kết nối AI...',
  streaming: 'AI đang trả lời...',
  speaking: 'Đang nói...',
  interrupted: 'Đã tạm dừng',
  reconnecting: 'Đang kết nối lại...',
  error: 'Cần thử lại',
});

export function speakingConversationReducer(state, action) {
  switch (action?.type) {
    case 'RESET':
      return { ...INITIAL_SPEAKING_CONVERSATION_STATE };
    case 'LISTEN_START':
      return withDerivedStatus({ ...state, microphone: 'listening', playback: 'idle', interrupted: false, error: '' });
    case 'TRANSCRIPT_PARTIAL':
      return withDerivedStatus({ ...state, microphone: 'transcribing', error: '' });
    case 'LISTEN_STOP':
      return ['listening', 'transcribing'].includes(state.microphone)
        ? withDerivedStatus({ ...state, microphone: 'idle' })
        : state;
    case 'TURN_SUBMIT':
      return withDerivedStatus({
        ...INITIAL_SPEAKING_CONVERSATION_STATE,
        transport: action.reconnecting ? 'reconnecting' : 'thinking',
        requestId: action.requestId || null,
        turnSequence: Number(action.turnSequence) || null,
      });
    case 'STREAM_EVENT': {
      const event = action.event || {};
      if (state.requestId && event.requestId && event.requestId !== state.requestId) return state;
      const eventSequence = Number(event.eventSequence) || 0;
      if (eventSequence && eventSequence <= state.lastEventSequence) return state;
      const next = { ...state, lastEventSequence: Math.max(state.lastEventSequence, eventSequence) };
      if (event.type === 'ack') return withDerivedStatus({ ...next, transport: 'thinking' });
      if (event.type === 'heartbeat') return next;
      if (event.type === 'delta' || event.type === 'result') return withDerivedStatus({ ...next, transport: 'streaming' });
      if (event.type === 'done') return withDerivedStatus({ ...next, transport: 'idle' });
      if (event.type === 'error') return withDerivedStatus({ ...next, transport: 'idle', error: event.error || 'SPEAKING_STREAM_FAILED' });
      return next;
    }
    case 'SPEECH_START':
      return withDerivedStatus({ ...state, playback: 'speaking', interrupted: false, error: '' });
    case 'SPEECH_END':
      return withDerivedStatus({ ...state, playback: 'idle' });
    case 'INTERRUPT':
      return withDerivedStatus({ ...state, microphone: 'idle', transport: 'idle', playback: 'idle', interrupted: true });
    case 'FAIL':
      return withDerivedStatus({ ...state, microphone: 'idle', transport: 'idle', playback: 'idle', error: action.error || 'SPEAKING_FAILED' });
    default:
      return state;
  }
}
