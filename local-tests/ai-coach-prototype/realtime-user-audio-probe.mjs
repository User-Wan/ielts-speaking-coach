import { readFile } from 'node:fs/promises';
import WebSocket from 'ws';

const wavPath = process.argv[2] ? new URL(process.argv[2], import.meta.url) : new URL('./tmp-free-chat-answer.wav', import.meta.url);
const wav = await readFile(wavPath);
const dataMarker = wav.indexOf(Buffer.from('data'));
if (dataMarker < 0) throw new Error('WAV data chunk not found');
const dataSize = wav.readUInt32LE(dataMarker + 4);
const pcm = wav.subarray(dataMarker + 8, dataMarker + 8 + dataSize);
const socket = new WebSocket('ws://127.0.0.1:4173/api/voice/stream', { origin: 'http://127.0.0.1:4173' });
const events = [];
let sessionReady = false;
const completedTranscripts = [];
let aiTranscript = '';
const aiTranscripts = [];

function textOf(event) {
  return typeof event.text === 'string' ? event.text : typeof event.delta === 'string' ? event.delta : typeof event.transcript === 'string' ? event.transcript : '';
}

const finished = new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error(`Timed out. Events: ${events.join(',')}`)), 45000);
  socket.on('message', raw => {
    const event = JSON.parse(raw.toString());
    events.push(event.type);
    if (event.type === 'conversation.item.input_audio_transcription.completed') completedTranscripts.push(textOf(event));
    if (event.type === 'response.output_text.delta') aiTranscript += textOf(event);
    if (event.type === 'response.output_text.done' && textOf(event)) {
      aiTranscript = textOf(event);
      aiTranscripts.push(aiTranscript);
    }
    if (event.type === 'local.ready') {
      socket.send(JSON.stringify({
        type: 'client.start',
        lesson: {
          interactionMode: 'topic-chat',
          endSmoothWindowMs: 2800,
          liveDirective: 'Have a natural short conversation. Acknowledge one real detail and ask one easy follow-up question.'
        }
      }));
    }
    if (event.type === 'session.created' && !sessionReady) {
      sessionReady = true;
      void sendAudio();
    }
    if (event.type === 'error' || event.type === 'local.error') reject(new Error(JSON.stringify(event)));
  });
  socket.on('error', reject);
  socket.on('close', () => { clearTimeout(timeout); resolve(); });
});

async function sendAudio() {
  const frameBytes = 640;
  const quietFrame = Buffer.alloc(frameBytes);
  for (let offset = 0; offset < frameBytes; offset += 2) quietFrame.writeInt16LE(offset % 4 === 0 ? 6 : -6, offset);
  for (let offset = 0; offset < pcm.length; offset += frameBytes) {
    const frame = pcm.subarray(offset, Math.min(offset + frameBytes, pcm.length));
    const padded = frame.length === frameBytes ? frame : Buffer.concat([frame, Buffer.alloc(frameBytes - frame.length)]);
    socket.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: padded.toString('base64') }));
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  for (let index = 0; index < 500; index += 1) {
    socket.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: quietFrame.toString('base64') }));
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  socket.close(1000, 'probe complete');
}

await new Promise((resolve, reject) => {
  socket.on('open', resolve);
  socket.on('error', reject);
});
await finished;
const counts = Object.fromEntries([...new Set(events)].map(type => [type, events.filter(item => item === type).length]));
console.log(JSON.stringify({ ok: true, completedTranscripts, aiTranscript, aiTranscripts, counts }, null, 2));
