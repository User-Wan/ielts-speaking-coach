import WebSocket from 'ws';

const socket = new WebSocket('ws://127.0.0.1:4173/api/voice/stream', {
  origin: 'http://127.0.0.1:4173'
});
const seen = [];
const timeout = setTimeout(() => {
  console.error(`LIVE_SMOKE_TIMEOUT events=${seen.join(',')}`);
  socket.terminate();
  process.exitCode = 1;
}, 15000);

socket.on('open', () => {
  socket.send(JSON.stringify({
    type: 'client.start',
    lesson: {
      question: 'Connection test only',
      currentStep: 1,
      instruction: 'Do not speak. This session only verifies authenticated session creation.'
    }
  }));
});

socket.on('message', raw => {
  const event = JSON.parse(raw.toString());
  seen.push(event.type);
  if (event.type === 'local.error' || event.type === 'error') {
    clearTimeout(timeout);
    console.error(`LIVE_SMOKE_FAILED type=${event.type} code=${event.code || event.status_code || 'unknown'} message=${event.message || 'unknown'}`);
    socket.close();
    process.exitCode = 1;
  }
  if (event.type === 'session.created') {
    socket.send(JSON.stringify({
      type: 'client.update',
      lesson: {
        question: 'Connection test only',
        currentStep: 2,
        interactionMode: 'echo-repeat',
        endSmoothWindowMs: 1100,
        instruction: 'Do not speak. This session only verifies a live session update.'
      }
    }));
  }
  if (event.type === 'session.updated') {
    clearTimeout(timeout);
    console.log(`LIVE_SMOKE_OK events=${seen.join(',')} input=${JSON.stringify(event.session?.audio?.input || null)}`);
    socket.send(JSON.stringify({ type: 'session.close' }));
    socket.close();
  }
});

socket.on('error', error => {
  clearTimeout(timeout);
  console.error(`LIVE_SMOKE_FAILED ${error.message}`);
  process.exitCode = 1;
});
