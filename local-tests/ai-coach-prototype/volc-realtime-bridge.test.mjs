import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import WebSocket, { WebSocketServer } from 'ws';
import { buildSessionCreate, buildSessionUpdate, configReady, createVoiceServer, generateTopicChatTurn, generateTopicOpeningQuestion, parseTopicChatTurn, textModelReady } from './volc-realtime-bridge.mjs';

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function close(server) {
  return new Promise(resolve => server.close(resolve));
}

test('requires only the local API key', () => {
  assert.equal(configReady({}), false);
  assert.equal(configReady({ VOLCENGINE_REALTIME_API_KEY: 'key' }), true);
});

test('requires a separate text model configuration for the dynamic opening question', () => {
  assert.equal(textModelReady({}), false);
  assert.equal(textModelReady({ VOLCENGINE_TEXT_API_KEY: 'text-key', VOLCENGINE_TEXT_MODEL: 'endpoint-id' }), true);
});

test('generates the first free-chat question from the current lesson instead of fixed copy', async () => {
  let request;
  const opening = await generateTopicOpeningQuestion({
    question: 'Why do people like to use social media?',
    highScoreAnswer: 'Social media is emotionally satisfying.'
  }, {
    VOLCENGINE_TEXT_API_KEY: 'text-key',
    VOLCENGINE_TEXT_MODEL: 'endpoint-id'
  }, async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"english":"When do you usually enjoy using social media most?","chinese":"你通常在什么时候最喜欢使用社交媒体？"}' } }] })
    };
  });
  assert.equal(opening.english, 'When do you usually enjoy using social media most?');
  assert.equal(opening.chinese, '你通常在什么时候最喜欢使用社交媒体？');
  const body = JSON.parse(request.options.body);
  assert.equal(body.model, 'endpoint-id');
  assert.deepEqual(body.thinking, { type: 'disabled' });
  assert.match(body.messages[0].content, /Current IELTS question: Why do people like to use social media/);
  assert.match(body.messages[0].content, /do not invent personal details/i);
});

test('accepts only the exact round-one topic-turn JSON grammar', () => {
  const turn = parseTopicChatTurn(JSON.stringify({
    acknowledgement: 'Using both apps gives you flexibility every day.',
    acknowledgementChinese: '每天同时使用这两个应用让你更灵活。',
    followUpQuestion: 'What do you usually look for first?',
    followUpQuestionChinese: '你通常会先找什么？'
  }), 1);
  assert.equal(turn.followUpQuestion, 'What do you usually look for first?');
  assert.throws(() => parseTopicChatTurn(JSON.stringify({
    acknowledgement: 'That makes sense. Let us continue.',
    acknowledgementChinese: '这很有道理。',
    followUpQuestion: 'Why? What else?',
    followUpQuestionChinese: '为什么？还有呢？'
  }), 1), /一句陈述|一个问号/);
  assert.throws(() => parseTopicChatTurn(JSON.stringify({
    acknowledgement: 'That sounds useful for your daily routine.',
    acknowledgementChinese: '这对你的日常生活很有用。',
    followUpQuestion: 'What do you use most?',
    followUpQuestionChinese: '你最常使用什么？'
  }), 2), /字段不符合规定/);
});

test('retries invalid structured chat output and returns only a validated dynamic turn', async () => {
  let calls = 0;
  const outputs = [
    '{"acknowledgement":"That makes sense. Let us continue.","acknowledgementChinese":"这很合理。","followUpQuestion":"Why? What else?","followUpQuestionChinese":"为什么？还有呢？"}',
    '{"acknowledgement":"Using both apps fits your different daily needs.","acknowledgementChinese":"同时使用这两个应用符合你每天的不同需求。","followUpQuestion":"Which feature helps you learn most?","followUpQuestionChinese":"哪个功能最能帮助你学习？"}'
  ];
  const turn = await generateTopicChatTurn({
    round: 1,
    question: 'Why do people like to use social media?',
    highScoreAnswer: 'People use it for many needs.',
    learnerAnswer: 'I use WeChat and Xiaohongshu for different things.'
  }, {
    VOLCENGINE_TEXT_API_KEY: 'text-key',
    VOLCENGINE_TEXT_MODEL: 'endpoint-id'
  }, async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.deepEqual(body.thinking, { type: 'disabled' });
    if (calls === 1) assert.match(body.messages[0].content, /PREVIOUS OUTPUT WAS REJECTED/);
    return { ok: true, json: async () => ({ choices: [{ message: { content: outputs[calls++] } }] }) };
  });
  assert.equal(calls, 2);
  assert.equal(turn.acknowledgement, 'Using both apps fits your different daily needs.');
  assert.equal(turn.followUpQuestion, 'Which feature helps you learn most?');
});

test('rejects a round-two reply that keeps asking questions after all retries', async () => {
  let calls = 0;
  await assert.rejects(() => generateTopicChatTurn({
    round: 2,
    question: 'Why do people like to use social media?',
    learnerAnswer: 'I mostly use it for learning.'
  }, {
    VOLCENGINE_TEXT_API_KEY: 'text-key',
    VOLCENGINE_TEXT_MODEL: 'endpoint-id'
  }, async () => {
    calls++;
    return { ok: true, json: async () => ({ choices: [{ message: { content: '{"acknowledgement":"What do you learn there?","acknowledgementChinese":"你在那里学什么？"}' } }] }) };
  }), /连续 3 次未通过结构校验/);
  assert.equal(calls, 3);
});

test('builds a Seeduplex full-duplex PCM session', () => {
  const payload = buildSessionCreate({ instructions: 'coach rules' }, {
    VOLCENGINE_REALTIME_MODEL: '1.2.6.1',
    VOLCENGINE_REALTIME_VOICE: 'test-voice',
    VOLCENGINE_REALTIME_SPEED: '20',
    VOLCENGINE_REALTIME_LOUDNESS: '-10'
  });
  assert.equal(payload.type, 'session.create');
  assert.equal(payload.session.type, 'realtime');
  assert.equal(payload.session.model, '1.2.6.1');
  assert.deepEqual(payload.session.audio.input.format, { type: 'pcm', sample_rate: 16000 });
  assert.deepEqual(payload.session.audio.output.format, { type: 'pcm_s16le', sample_rate: 24000 });
  assert.equal(payload.session.audio.output.voice, 'test-voice');
  assert.equal(payload.session.audio.input.end_smooth_window_ms, 5000);
  assert.equal(payload.session.audio.output.speed, 20);
  assert.equal(payload.session.audio.output.loudness, -10);
  assert.equal(payload.session.tools.some(tool => tool.name === 'render_bilingual_caption'), true);
  assert.match(payload.session.tools.find(tool => tool.name === 'render_bilingual_caption').description, /Chinese translation/i);
});

test('limits prompt size and bounds audio controls', () => {
  const payload = buildSessionCreate({ instructions: 'x'.repeat(20000) }, {
    VOLCENGINE_REALTIME_SPEED: '999',
    VOLCENGINE_REALTIME_LOUDNESS: '-999'
  });
  assert.equal(payload.session.instructions.length, 18000);
  assert.equal(payload.session.audio.output.speed, 100);
  assert.equal(payload.session.audio.output.loudness, -50);
});

test('updates turn detection for fast repetition without changing the audio contract', () => {
  const payload = buildSessionUpdate({ instructions: 'repeat mode', endSmoothWindowMs: 1100 }, {
    VOLCENGINE_REALTIME_MODEL: '1.2.6.1',
    VOLCENGINE_REALTIME_VOICE: 'test-voice'
  });
  assert.equal(payload.type, 'session.update');
  assert.equal(payload.session.audio.input.end_smooth_window_ms, 1100);
  assert.deepEqual(payload.session.audio.input.format, { type: 'pcm', sample_rate: 16000 });
  assert.equal(payload.session.audio.output.voice, 'test-voice');
});

test('relays a full-duplex session without exposing the API key to the browser', async () => {
  const mockHttp = createServer();
  const mockUpstream = new WebSocketServer({ server: mockHttp });
  const upstreamPort = await listen(mockHttp);
  let handshakeKey = '';
  const upstreamMessages = [];

  mockUpstream.on('connection', (socket, request) => {
    handshakeKey = request.headers['x-api-key'];
    socket.on('message', raw => {
      const message = JSON.parse(raw.toString());
      upstreamMessages.push(message);
      if (message.type === 'session.create') {
        socket.send(JSON.stringify({ type: 'session.created', session: { id: 'mock-dialog' } }));
      }
    });
  });

  const bridge = await createVoiceServer({ env: {
    VOLCENGINE_REALTIME_API_KEY: 'test-secret',
    VOLCENGINE_REALTIME_WS_URL: `ws://127.0.0.1:${upstreamPort}/dialogue`
  } });
  const bridgePort = await listen(bridge);
  const browserSocket = new WebSocket(`ws://127.0.0.1:${bridgePort}/api/voice/stream`, {
    origin: `http://127.0.0.1:${bridgePort}`
  });

  const browserEvents = [];
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('mock relay timed out')), 3000);
    browserSocket.on('open', () => browserSocket.send(JSON.stringify({
      type: 'client.start',
      lesson: { question: 'Test question' }
    })));
    browserSocket.on('message', raw => {
      const event = JSON.parse(raw.toString());
      browserEvents.push(event);
      if (event.type === 'session.created') {
        browserSocket.send(JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: 'AAAA'
        }));
        setTimeout(() => { clearTimeout(timer); resolve(); }, 30);
      }
    });
    browserSocket.on('error', reject);
  });

  assert.equal(handshakeKey, 'test-secret');
  assert.equal(browserEvents.some(event => JSON.stringify(event).includes('test-secret')), false);
  assert.equal(upstreamMessages[0].type, 'session.create');
  assert.match(upstreamMessages[0].session.instructions, /NON-NEGOTIABLE EXECUTION ORDER/);
  assert.match(upstreamMessages[0].session.instructions, /FIRST WARM-UP ANSWER: EXACT OUTPUT CONTRACT/);
  assert.match(upstreamMessages[0].session.instructions, /SECOND WARM-UP ANSWER: EXACT OUTPUT CONTRACT/);
  assert.match(upstreamMessages[0].session.instructions, /Spoken sentences: exactly 2/);
  assert.match(upstreamMessages[0].session.instructions, /Questions: 0/);
  assert.match(upstreamMessages[0].session.instructions, /The client owns progression/);
  assert.equal(upstreamMessages[0].session.audio.input.format.sample_rate, 16000);
  assert.equal(upstreamMessages.some(event => event.type === 'input_audio_buffer.append'), true);

  browserSocket.close();
  await new Promise(resolve => browserSocket.once('close', resolve));
  mockUpstream.close();
  await close(bridge);
  await close(mockHttp);
});
