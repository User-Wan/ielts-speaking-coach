import { writeFile } from 'node:fs/promises';
import WebSocket from 'ws';

const port = process.env.PROBE_PORT || '4173';
const output = process.env.AUDITION_OUTPUT || 'voice-audition.wav';
const text = process.env.AUDITION_TEXT || 'Hi, I am Lindsey, your AI speaking coach. Today, we will practise English together, one sentence at a time.';
const chunks = [];
const socket = new WebSocket(`ws://127.0.0.1:${port}/api/voice/stream`, { origin: `http://127.0.0.1:${port}` });
const timeout = setTimeout(() => {
  console.error(`AUDITION_FAILED timeout port=${port}`);
  socket.terminate();
  process.exitCode = 1;
}, 30000);

function wavFromPcm(pcm, sampleRate = 24000) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

socket.on('open', () => socket.send(JSON.stringify({
  type: 'client.start',
  lesson: { question: 'Voice audition only', instruction: 'Speak only the committed English text.' }
})));

socket.on('message', async raw => {
  const event = JSON.parse(raw.toString());
  if (event.type === 'session.created') {
    socket.send(JSON.stringify({ type: 'speech_text_buffer.commit', event_id: 'audition', text }));
  }
  if (event.type === 'response.output_audio.delta') {
    const audio = event.audio || event.delta;
    if (audio) chunks.push(Buffer.from(audio, 'base64'));
  }
  if (event.type === 'response.done') {
    clearTimeout(timeout);
    const pcm = Buffer.concat(chunks);
    await writeFile(output, wavFromPcm(pcm));
    console.log(`AUDITION_OK output=${output} pcm_bytes=${pcm.length}`);
    socket.send(JSON.stringify({ type: 'session.close' }));
    socket.close();
  }
  if (event.type === 'local.error' || event.type === 'error') {
    clearTimeout(timeout);
    console.error(`AUDITION_FAILED type=${event.type} code=${event.code || event.status_code || 'unknown'} message=${event.message || 'unknown'}`);
    socket.close();
    process.exitCode = 1;
  }
});

socket.on('error', error => {
  clearTimeout(timeout);
  console.error(`AUDITION_FAILED ${error.message}`);
  process.exitCode = 1;
});
