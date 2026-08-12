import WebSocket from 'ws';

const sentences = [
  'Hi, I am Lindsey, your AI speaking coach.',
  'Today we will practise this question: Why do people like to use social media?',
  'By the end of this lesson, you will be able to give a clear, complete answer.',
  'I am going to read the full answer first.',
  'Are you ready to listen?'
];
const socket = new WebSocket('ws://127.0.0.1:4173/api/voice/stream', { origin: 'http://127.0.0.1:4173' });
const turns = sentences.map(text => ({ text, audioStarted: 0, audioDone: 0, responseDone: 0 }));
let index = -1;
const timeout = setTimeout(() => {
  console.error(JSON.stringify({ ok: false, reason: 'timeout', index, turns }, null, 2));
  socket.terminate();
  process.exitCode = 1;
}, 45000);

function sendNext() {
  index += 1;
  if (index >= sentences.length) {
    clearTimeout(timeout);
    console.log(JSON.stringify({ ok: true, turns }, null, 2));
    socket.send(JSON.stringify({ type: 'session.close' }));
    socket.close();
    return;
  }
  socket.send(JSON.stringify({ type: 'speech_text_buffer.commit', event_id: `sequence-${index}`, text: sentences[index] }));
}

socket.on('open', () => socket.send(JSON.stringify({
  type: 'client.start',
  lesson: { question: 'Opening sequence end-to-end probe', currentStep: 1, instruction: 'Speak only committed text.' }
})));

socket.on('message', raw => {
  const event = JSON.parse(raw.toString());
  if (event.type === 'session.created') { sendNext(); return; }
  if (event.type === 'response.output_audio.started' && index >= 0) turns[index].audioStarted += 1;
  if (event.type === 'response.output_audio.done' && index >= 0) turns[index].audioDone += 1;
  if (event.type === 'response.done' && index >= 0) {
    turns[index].responseDone += 1;
    setTimeout(sendNext, 100);
  }
  if (event.type === 'local.error' || event.type === 'error') {
    clearTimeout(timeout);
    console.error(JSON.stringify({ ok: false, event, index, turns }, null, 2));
    socket.close();
    process.exitCode = 1;
  }
});

socket.on('error', error => {
  clearTimeout(timeout);
  console.error(JSON.stringify({ ok: false, reason: error.message, index, turns }, null, 2));
  process.exitCode = 1;
});
