import WebSocket from 'ws';

const port = process.env.PROBE_PORT || '4173';
const socket = new WebSocket(`ws://127.0.0.1:${port}/api/voice/stream`, {
  origin: `http://127.0.0.1:${port}`
});
const timeline = [];
const timeout = setTimeout(() => {
  console.error(JSON.stringify({ ok: false, reason: 'timeout', timeline }, null, 2));
  socket.terminate();
  process.exitCode = 1;
}, 30000);

socket.on('open', () => socket.send(JSON.stringify({
  type: 'client.start',
  lesson: { question: 'TTS subtitle event probe', currentStep: 1 }
})));

socket.on('message', raw => {
  const event = JSON.parse(raw.toString());
  const entry = { type: event.type };
  const text = event.text || event.delta || event.transcript;
  if (typeof text === 'string' && !event.audio) entry.text = text.slice(0, 100);
  if (event.audio) entry.audioBytesBase64 = event.audio.length;
  if (event.type === 'response.output_audio.started') entry.ttsType = event.tts_type;
  timeline.push(entry);

  if (event.type === 'session.created') {
    socket.send(JSON.stringify({
      type: 'speech_text_buffer.commit',
      event_id: 'subtitle-probe',
      text: 'Hi, I am Lindsey. Welcome to today\'s speaking lesson.'
    }));
  }
  if (event.type === 'response.done') {
    clearTimeout(timeout);
    console.log(JSON.stringify({ ok: true, timeline }, null, 2));
    socket.send(JSON.stringify({ type: 'session.close' }));
    socket.close();
  }
  if (event.type === 'local.error' || event.type === 'error') {
    clearTimeout(timeout);
    console.error(JSON.stringify({ ok: false, event, timeline }, null, 2));
    socket.close();
    process.exitCode = 1;
  }
});

socket.on('error', error => {
  clearTimeout(timeout);
  console.error(JSON.stringify({ ok: false, reason: error.message, timeline }, null, 2));
  process.exitCode = 1;
});
