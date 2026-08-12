(function () {
  const INPUT_RATE = 16000;
  const OUTPUT_RATE = 24000;
  const FRAME_SAMPLES = 320;
  const FRAME_BYTES = FRAME_SAMPLES * 2;
  const PLAYBACK_START_BUFFER_MS = 240;
  const PLAYBACK_RESUME_BUFFER_MS = 180;
  const PLAYBACK_SCHEDULE_LEAD_SECONDS = 0.025;

  function bytesToBase64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
  }

  function base64ToBytes(value) {
    const raw = atob(value);
    const output = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
    return output;
  }

  function downsampleToPcm16(input, inputRate) {
    const ratio = inputRate / INPUT_RATE;
    const length = Math.floor(input.length / ratio);
    const output = new Int16Array(length);
    for (let i = 0; i < length; i += 1) {
      const start = Math.floor(i * ratio);
      const end = Math.max(start + 1, Math.min(input.length, Math.floor((i + 1) * ratio)));
      let sum = 0;
      for (let j = start; j < end; j += 1) sum += input[j];
      const sample = Math.max(-1, Math.min(1, sum / (end - start)));
      output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }
    return new Uint8Array(output.buffer);
  }

  function eventText(event) {
    if (typeof event.text === 'string') return event.text;
    if (typeof event.delta === 'string') return event.delta;
    if (typeof event.transcript === 'string') return event.transcript;
    return '';
  }

  function collapseRepeatedTail(value) {
    const words = String(value || '').trim().split(/\s+/).filter(Boolean);
    let changed = true;
    while (changed) {
      changed = false;
      for (let size = Math.min(8, Math.floor(words.length / 2)); size >= 2; size -= 1) {
        const tail = words.slice(-size).join(' ').toLowerCase();
        const before = words.slice(-size * 2, -size).join(' ').toLowerCase();
        if (tail !== before) continue;
        words.splice(-size, size);
        changed = true;
        break;
      }
    }
    return words.join(' ');
  }

  function transcriptWords(value) {
    return String(value || '').toLowerCase().replace(/[’']/g, '').match(/[a-z0-9]+/g) || [];
  }

  function orderedTranscriptMatches(left, right) {
    const row = Array(right.length + 1).fill(0);
    for (const word of left) {
      let previous = 0;
      for (let index = 1; index <= right.length; index += 1) {
        const saved = row[index];
        row[index] = word === right[index - 1] ? previous + 1 : Math.max(row[index], row[index - 1]);
        previous = saved;
      }
    }
    return row[right.length];
  }

  function looksLikeRevisedHypothesis(previous, incoming) {
    const beforeWords = transcriptWords(previous);
    const nextWords = transcriptWords(incoming);
    if (beforeWords.length < 2 || nextWords.length < 2) return false;
    let prefix = 0;
    while (prefix < Math.min(beforeWords.length, nextWords.length) && beforeWords[prefix] === nextWords[prefix]) prefix += 1;
    const relativeLength = nextWords.length / beforeWords.length;
    if (prefix >= 2 && relativeLength >= 0.45) return true;
    if (prefix < 1 || relativeLength < 0.8) return false;
    const shared = orderedTranscriptMatches(beforeWords, nextWords);
    return shared / Math.min(beforeWords.length, nextWords.length) >= 0.75;
  }

  function mergeStreamingTranscript(previous, incoming) {
    const before = collapseRepeatedTail(previous);
    const next = collapseRepeatedTail(incoming);
    if (!next) return collapseRepeatedTail(before);
    if (!before) return collapseRepeatedTail(next);
    const beforeLower = before.toLowerCase();
    const nextLower = next.toLowerCase();
    if (nextLower.startsWith(beforeLower)) return collapseRepeatedTail(next);
    if (beforeLower.endsWith(nextLower)) return collapseRepeatedTail(before);
    if (looksLikeRevisedHypothesis(before, next)) return collapseRepeatedTail(next);
    const maxOverlap = Math.min(before.length, next.length);
    for (let length = maxOverlap; length > 0; length -= 1) {
      if (beforeLower.slice(-length) === nextLower.slice(0, length)) return collapseRepeatedTail(before + next.slice(length));
    }
    const needsSpace = !/\s$/.test(before) && !/^[\s,.;!?']/u.test(next);
    return collapseRepeatedTail(before + (needsSpace ? ' ' : '') + next);
  }

  function transcriptTokenSpans(value) {
    return [...String(value || '').matchAll(/[a-z0-9]+/gi)].map(match => ({
      word: match[0].toLowerCase(),
      start: match.index,
      end: match.index + match[0].length
    }));
  }

  function stableTranscriptPrefix(previousHypothesis, nextHypothesis) {
    const previous = transcriptTokenSpans(previousHypothesis);
    const next = transcriptTokenSpans(nextHypothesis);
    let shared = 0;
    while (shared < Math.min(previous.length, next.length) && previous[shared].word === next[shared].word) shared += 1;
    const sameHypothesis = previous.length === next.length && shared === previous.length;
    const committed = sameHypothesis ? shared : Math.max(0, shared - 1);
    if (!committed) return '';
    const end = committed < next.length ? next[committed].start : String(nextHypothesis || '').length;
    return String(nextHypothesis || '').slice(0, end).trim();
  }

  function extendStableTranscript(stable, candidate) {
    if (!candidate) return stable || '';
    if (!stable) return candidate;
    const stableTokens = transcriptTokenSpans(stable);
    const candidateTokens = transcriptTokenSpans(candidate);
    if (candidateTokens.length <= stableTokens.length) return stable;
    for (let index = 0; index < stableTokens.length; index += 1) {
      if (stableTokens[index].word !== candidateTokens[index]?.word) return stable;
    }
    return stable + candidate.slice(candidateTokens[stableTokens.length - 1].end);
  }

  class PcmStreamPlayer {
    constructor({ onProgress, onIdle } = {}) {
      this.context = null;
      this.nextPlayTime = 0;
      this.sources = new Set();
      this.onProgress = onProgress;
      this.onIdle = onIdle;
      this.playedSeconds = 0;
      this.pendingEnqueues = 0;
      this.pendingBuffers = [];
      this.pendingBufferMs = 0;
      this.needsPreroll = true;
      this.turnActive = false;
      this.turnEnded = false;
    }

    async prepare() {
      if (!this.context || this.context.state === 'closed') this.context = new AudioContext({ sampleRate: OUTPUT_RATE });
      if (this.context.state === 'suspended') await this.context.resume();
    }

    async enqueue(bytes) {
      if (!bytes?.length) return;
      this.pendingEnqueues += 1;
      try {
        await this.prepare();
        const sampleCount = Math.floor(bytes.length / 2);
        const buffer = this.context.createBuffer(1, sampleCount, OUTPUT_RATE);
        const channel = buffer.getChannelData(0);
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        for (let i = 0; i < sampleCount; i += 1) channel[i] = view.getInt16(i * 2, true) / 32768;
        if (!this.sources.size && this.remainingPlaybackMs() <= 5) this.needsPreroll = true;
        this.pendingBuffers.push(buffer);
        this.pendingBufferMs += buffer.duration * 1000;
      } finally {
        this.pendingEnqueues -= 1;
      }
      this.drainBufferedAudio(this.turnEnded);
      this.finishTurnIfIdle();
    }

    drainBufferedAudio(force = false) {
      if (!this.context || !this.pendingBuffers.length) return;
      const threshold = this.playedSeconds > 0 ? PLAYBACK_RESUME_BUFFER_MS : PLAYBACK_START_BUFFER_MS;
      if (!force && this.needsPreroll && this.pendingBufferMs < threshold) return;
      const buffers = this.pendingBuffers;
      this.pendingBuffers = [];
      this.pendingBufferMs = 0;
      this.needsPreroll = false;
      let startAt = Math.max(this.nextPlayTime, this.context.currentTime + PLAYBACK_SCHEDULE_LEAD_SECONDS);
      for (const buffer of buffers) {
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.connect(this.context.destination);
        source.onended = () => {
          if (!this.sources.has(source)) return;
          this.sources.delete(source);
          this.playedSeconds += buffer.duration;
          this.onProgress?.(this.playedSeconds);
          if (!this.sources.size && !this.turnEnded) this.needsPreroll = true;
          if (this.turnEnded) this.drainBufferedAudio(true);
          this.finishTurnIfIdle();
        };
        this.sources.add(source);
        source.start(startAt);
        startAt += buffer.duration;
      }
      this.nextPlayTime = startAt;
    }

    beginTurn() {
      this.playedSeconds = 0;
      this.pendingEnqueues = 0;
      this.pendingBuffers = [];
      this.pendingBufferMs = 0;
      this.needsPreroll = true;
      this.turnActive = true;
      this.turnEnded = false;
    }

    markTurnEnded() {
      this.turnEnded = true;
      this.drainBufferedAudio(true);
      this.finishTurnIfIdle();
    }

    remainingPlaybackMs() {
      if (!this.context) return 0;
      return Math.max(0, (this.nextPlayTime - this.context.currentTime) * 1000);
    }

    finishTurnIfIdle() {
      if (!this.turnActive || !this.turnEnded || this.pendingEnqueues || this.pendingBuffers.length || this.sources.size) return;
      this.turnActive = false;
      this.onIdle?.();
    }

    stop() {
      this.turnActive = false;
      this.turnEnded = false;
      for (const source of this.sources) {
        try { source.stop(); } catch {}
      }
      this.sources.clear();
      this.pendingBuffers = [];
      this.pendingBufferMs = 0;
      this.pendingEnqueues = 0;
      this.needsPreroll = true;
      this.nextPlayTime = this.context?.currentTime || 0;
    }

    async close() {
      this.stop();
      if (this.context && this.context.state !== 'closed') await this.context.close().catch(() => {});
      this.context = null;
    }
  }

  class LindseyRealtimeVoice {
    constructor(callbacks = {}) {
      this.callbacks = callbacks;
      this.socket = null;
      this.stream = null;
      this.inputContext = null;
      this.inputSource = null;
      this.processor = null;
      this.silentGain = null;
      this.frameTimer = null;
      this.pendingInput = new Uint8Array(0);
      this.player = new PcmStreamPlayer({
        onProgress: seconds => this.syncAiTranscript(seconds),
        onIdle: () => this.markAiPlaybackFinished()
      });
      this.connected = false;
      this.sessionCreated = false;
      this.aiSpeaking = false;
      this.userTranscript = '';
      this.userRawHypothesis = '';
      this.userStableTranscript = '';
      this.aiTranscript = '';
      this.visibleAiTranscript = '';
      this.aiTurnPrepared = false;
      this.greeting = '';
      this.queuedSpeechText = '';
      this.closingByUser = false;
      this.deferAutonomousPlayback = false;
      this.deferredAudioChunks = [];
      this.deferredAudioEnded = false;
      this.deferredAudioTimer = null;
      this.autonomousPlaybackDelayMs = 250;
      this.aiPlaybackFinished = false;
      this.aiResponseFinished = false;
      this.aiFinishFallbackTimer = null;
      this.aiDrainFallbackTimer = null;
      this.audioRetryCount = 0;
      this.audioRetryTimer = null;
      this.replayingIncompleteAudio = false;
      this.suppressNextAutonomousReply = false;
      this.suppressingAutonomousReply = false;
      this.suppressedReplyFallbackTimer = null;
      this.microphoneInputEnabled = true;
    }

    emit(name, value) {
      if (typeof this.callbacks[name] === 'function') this.callbacks[name](value);
    }

    prepareAiTurn() {
      if (this.aiTurnPrepared) return;
      if (!this.replayingIncompleteAudio) this.audioRetryCount = 0;
      this.aiTurnPrepared = true;
      this.aiTranscript = '';
      this.visibleAiTranscript = '';
      this.aiPlaybackFinished = false;
      this.aiResponseFinished = false;
      if (this.aiFinishFallbackTimer) clearTimeout(this.aiFinishFallbackTimer);
      this.aiFinishFallbackTimer = null;
      if (this.aiDrainFallbackTimer) clearTimeout(this.aiDrainFallbackTimer);
      this.aiDrainFallbackTimer = null;
      this.player.beginTurn();
    }

    syncAiTranscript(playedSeconds, force = false) {
      if (!this.aiTranscript) return;
      if (!force && playedSeconds <= 0) return;
      const words = this.aiTranscript.match(/\S+\s*/g) || [];
      const visibleWords = force ? words.length : Math.min(words.length, Math.max(1, Math.floor(playedSeconds * 2.55)));
      const visible = words.slice(0, visibleWords).join('').trimEnd();
      if (!visible || visible === this.visibleAiTranscript) return;
      this.visibleAiTranscript = visible;
      this.emit('onAiText', visible);
    }

    markAiPlaybackFinished() {
      if (this.aiPlaybackFinished) return;
      this.aiPlaybackFinished = true;
      if (this.aiDrainFallbackTimer) clearTimeout(this.aiDrainFallbackTimer);
      this.aiDrainFallbackTimer = null;
      if (!this.aiResponseFinished && !this.aiFinishFallbackTimer) {
        this.aiFinishFallbackTimer = setTimeout(() => this.finishAiPlayback(true), 1500);
      }
      this.finishAiPlayback();
    }

    markAiResponseFinished() {
      this.aiResponseFinished = true;
      this.finishAiPlayback();
    }

    finishAiPlayback(force = false) {
      if (!force && (!this.aiPlaybackFinished || !this.aiResponseFinished)) return;
      if (this.aiFinishFallbackTimer) clearTimeout(this.aiFinishFallbackTimer);
      this.aiFinishFallbackTimer = null;
      if (this.aiDrainFallbackTimer) clearTimeout(this.aiDrainFallbackTimer);
      this.aiDrainFallbackTimer = null;
      const spokenWords = this.aiTranscript.match(/[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)?/g) || [];
      const minimumAudioSeconds = spokenWords.length ? Math.max(0.18, spokenWords.length / 5.5) : 0;
      if (minimumAudioSeconds && this.player.playedSeconds + 0.08 < minimumAudioSeconds) {
        const retryText = this.aiTranscript.trim();
        if (retryText && this.audioRetryCount < 1) {
          this.audioRetryCount += 1;
          this.replayingIncompleteAudio = true;
          this.aiSpeaking = false;
          this.aiTurnPrepared = false;
          this.aiPlaybackFinished = false;
          this.aiResponseFinished = false;
          this.player.stop();
          this.emit('onState', 'ai-retrying');
          this.emit('onAudioRetry', { playedSeconds: this.player.playedSeconds, minimumAudioSeconds });
          if (this.audioRetryTimer) clearTimeout(this.audioRetryTimer);
          this.audioRetryTimer = setTimeout(() => {
            this.audioRetryTimer = null;
            this.sendText(retryText);
          }, 320);
          return;
        }
        this.emit('onError', '这句话的音频没有完整传输，已暂停自动推进，请重新连接后再试。');
        return;
      }
      this.syncAiTranscript(Number.POSITIVE_INFINITY, true);
      this.replayingIncompleteAudio = false;
      this.audioRetryCount = 0;
      this.aiSpeaking = false;
      this.aiTurnPrepared = false;
      this.emit('onState', 'listening');
      this.emit('onTurnDone', { canceled: false });
    }

    clearDeferredAudio() {
      if (this.deferredAudioTimer) clearTimeout(this.deferredAudioTimer);
      this.deferredAudioTimer = null;
      this.deferAutonomousPlayback = false;
      this.deferredAudioChunks = [];
      this.deferredAudioEnded = false;
    }

    releaseDeferredAudio() {
      if (!this.deferAutonomousPlayback) return;
      const chunks = this.deferredAudioChunks;
      const turnEnded = this.deferredAudioEnded;
      this.deferredAudioTimer = null;
      this.deferAutonomousPlayback = false;
      this.deferredAudioChunks = [];
      this.deferredAudioEnded = false;
      this.emit('onState', 'ai-speaking');
      if (!this.aiSpeaking) {
        this.player.stop();
        return;
      }
      for (const chunk of chunks) this.player.enqueue(chunk).catch(error => this.emit('onError', error.message));
      if (turnEnded) this.player.markTurnEnded();
    }

    async connect({ lesson = {}, greeting = '' } = {}) {
      if (this.socket && this.socket.readyState <= WebSocket.OPEN) return;
      const status = await fetch('/api/voice/status', { cache: 'no-store' }).then(response => response.json());
      if (!status.ready) throw new Error('请先在本机 .env 中填写火山引擎 API Key。');

      this.greeting = greeting;
      this.closingByUser = false;
      this.emit('onState', 'connecting');
      await this.prepareMicrophone();
      await this.player.prepare();

      const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
      this.socket = new WebSocket(`${scheme}//${location.host}/api/voice/stream`);
      this.socket.addEventListener('open', () => {
        this.send({ type: 'client.start', lesson });
      });
      this.socket.addEventListener('message', event => this.handleMessage(event.data));
      this.socket.addEventListener('close', () => {
        this.connected = false;
        this.sessionCreated = false;
        this.stopFramePump();
        this.emit('onState', 'closed');
      });
      this.socket.addEventListener('error', () => this.emit('onError', '本地实时语音连接失败。'));
    }

    async prepareMicrophone() {
      if (this.stream) return;
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      this.inputContext = new AudioContext();
      if (this.inputContext.state === 'suspended') await this.inputContext.resume();
      this.inputSource = this.inputContext.createMediaStreamSource(this.stream);
      this.processor = this.inputContext.createScriptProcessor(4096, 1, 1);
      this.silentGain = this.inputContext.createGain();
      this.silentGain.gain.value = 0;
      this.processor.onaudioprocess = event => {
        const activeInputContext = this.inputContext;
        if (!activeInputContext || activeInputContext.state === 'closed') return;
        if (!this.microphoneInputEnabled) return;
        const pcm = downsampleToPcm16(event.inputBuffer.getChannelData(0), activeInputContext.sampleRate);
        const merged = new Uint8Array(this.pendingInput.length + pcm.length);
        merged.set(this.pendingInput);
        merged.set(pcm, this.pendingInput.length);
        this.pendingInput = merged;
      };
      this.inputSource.connect(this.processor);
      this.processor.connect(this.silentGain);
      this.silentGain.connect(this.inputContext.destination);
    }

    startFramePump() {
      if (this.frameTimer) return;
      this.frameTimer = setInterval(() => {
        if (!this.sessionCreated) return;
        let frame = new Uint8Array(FRAME_BYTES);
        if (this.microphoneInputEnabled && this.pendingInput.length >= FRAME_BYTES) {
          frame = this.pendingInput.slice(0, FRAME_BYTES);
          this.pendingInput = this.pendingInput.slice(FRAME_BYTES);
        }
        this.send({ type: 'input_audio_buffer.append', event_id: crypto.randomUUID(), audio: bytesToBase64(frame) });
      }, 20);
    }

    stopFramePump() {
      if (this.frameTimer) clearInterval(this.frameTimer);
      this.frameTimer = null;
      this.pendingInput = new Uint8Array(0);
    }

    send(payload) {
      if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(payload));
    }

    sendText(text) {
      if (!text) return;
      this.queuedSpeechText = text;
      this.send({ type: 'speech_text_buffer.commit', event_id: crypto.randomUUID(), text });
    }

    updateLesson(lesson) {
      if (this.sessionCreated) this.send({ type: 'client.update', lesson });
    }

    setMicrophoneInputEnabled(enabled) {
      this.microphoneInputEnabled = Boolean(enabled);
      this.pendingInput = new Uint8Array(0);
      if (!this.microphoneInputEnabled) {
        this.userTranscript = '';
        this.userRawHypothesis = '';
        this.userStableTranscript = '';
      }
    }

    suppressNextResponse(timeoutMs = 1400) {
      if (this.suppressedReplyFallbackTimer) clearTimeout(this.suppressedReplyFallbackTimer);
      this.suppressNextAutonomousReply = true;
      this.suppressingAutonomousReply = false;
      this.suppressedReplyFallbackTimer = setTimeout(() => {
        this.suppressedReplyFallbackTimer = null;
        if (!this.suppressNextAutonomousReply || this.suppressingAutonomousReply) return;
        this.suppressNextAutonomousReply = false;
        this.emit('onState', 'listening');
        this.emit('onSuppressedResponseDone');
      }, Math.max(300, Number(timeoutMs) || 1400));
    }

    suppressAutonomousReply() {
      if (this.suppressingAutonomousReply) return true;
      if (!this.suppressNextAutonomousReply || this.queuedSpeechText) return false;
      this.suppressNextAutonomousReply = false;
      this.suppressingAutonomousReply = true;
      if (this.suppressedReplyFallbackTimer) clearTimeout(this.suppressedReplyFallbackTimer);
      this.send({ type: 'response.cancel', event_id: crypto.randomUUID() });
      this.suppressedReplyFallbackTimer = setTimeout(() => {
        this.suppressedReplyFallbackTimer = null;
        this.finishSuppressedReply();
      }, 500);
      return true;
    }

    finishSuppressedReply() {
      if (!this.suppressingAutonomousReply) return false;
      if (this.suppressedReplyFallbackTimer) clearTimeout(this.suppressedReplyFallbackTimer);
      this.suppressedReplyFallbackTimer = null;
      this.suppressingAutonomousReply = false;
      this.aiSpeaking = false;
      this.aiTurnPrepared = false;
      this.aiTranscript = '';
      this.visibleAiTranscript = '';
      this.emit('onState', 'listening');
      this.emit('onSuppressedResponseDone');
      return true;
    }

    interrupt() {
      this.clearDeferredAudio();
      this.player.stop();
      if (this.aiSpeaking) this.send({ type: 'response.cancel', event_id: crypto.randomUUID() });
      this.aiSpeaking = false;
      this.emit('onState', 'listening');
    }

    commitAudio() {
      this.send({ type: 'input_audio_buffer.commit', event_id: crypto.randomUUID() });
    }

    handleMessage(raw) {
      let event;
      try { event = JSON.parse(raw); }
      catch { return; }

      if (event.type === 'local.error' || event.type === 'error') {
        if (event.code === 'UPSTREAM_NOT_READY' && !this.sessionCreated) return;
        this.emit('onError', event.message || '实时语音服务返回错误。');
        return;
      }
      if (event.type === 'local.closed') {
        this.stopFramePump();
        this.sessionCreated = false;
        if (!this.closingByUser) {
          const detail = event.reason ? `：${event.reason}` : '';
          this.emit('onError', `实时语音服务已断开${detail}`);
        }
        this.socket?.close();
        return;
      }
      if (event.type === 'local.connected') {
        this.connected = true;
        this.emit('onState', 'connected');
        return;
      }
      if (event.type === 'session.created') {
        this.sessionCreated = true;
        this.startFramePump();
        this.emit('onState', 'listening');
        if (this.greeting) this.sendText(this.greeting);
        return;
      }
      if (!this.microphoneInputEnabled && event.type.startsWith('conversation.item.input_audio_transcription.')) {
        return;
      }
      if (event.type === 'conversation.item.input_audio_transcription.started') {
        this.userTranscript = '';
        this.userRawHypothesis = '';
        this.userStableTranscript = '';
        const wasAiResponding = this.aiSpeaking || this.aiTurnPrepared || this.deferAutonomousPlayback;
        if (wasAiResponding) this.send({ type: 'response.cancel', event_id: crypto.randomUUID() });
        const discardedDeferredReply = this.deferAutonomousPlayback;
        this.clearDeferredAudio();
        this.player.stop();
        this.aiSpeaking = false;
        if (discardedDeferredReply) {
          this.aiTurnPrepared = false;
          this.aiTranscript = '';
          this.visibleAiTranscript = '';
        }
        this.emit('onState', 'user-speaking');
        return;
      }
      if (event.type === 'conversation.item.input_audio_transcription.delta') {
        const previousHypothesis = this.userRawHypothesis;
        const nextHypothesis = mergeStreamingTranscript(previousHypothesis, eventText(event));
        const stableCandidate = stableTranscriptPrefix(previousHypothesis, nextHypothesis);
        const nextStable = extendStableTranscript(this.userStableTranscript, stableCandidate);
        this.userRawHypothesis = nextHypothesis;
        this.userTranscript = nextHypothesis;
        this.emit('onUserHypothesis', nextHypothesis);
        if (nextStable !== this.userStableTranscript) {
          this.userStableTranscript = nextStable;
          this.emit('onUserText', this.userStableTranscript);
        }
        return;
      }
      if (event.type === 'conversation.item.input_audio_transcription.completed') {
        const finalText = eventText(event);
        if (finalText) this.userTranscript = finalText;
        this.userRawHypothesis = this.userTranscript;
        this.userStableTranscript = this.userTranscript;
        this.emit('onUserFinalText', this.userTranscript);
        this.emit('onUserTurnDone', this.userTranscript);
        this.emit('onState', 'thinking');
        return;
      }
      if (event.type === 'response.output_text.delta') {
        if (this.suppressAutonomousReply() || this.suppressingAutonomousReply) return;
        this.prepareAiTurn();
        this.aiTranscript += eventText(event);
        this.syncAiTranscript(this.player.playedSeconds);
        return;
      }
      if (event.type === 'response.output_text.done') {
        if (this.suppressAutonomousReply() || this.suppressingAutonomousReply) return;
        this.prepareAiTurn();
        const finalText = eventText(event);
        if (finalText) this.aiTranscript = finalText;
        this.syncAiTranscript(this.player.playedSeconds);
        return;
      }
      if (event.type === 'response.output_audio.started') {
        if (this.suppressAutonomousReply() || this.suppressingAutonomousReply) return;
        this.prepareAiTurn();
        const isDirectScriptedSpeech = Boolean(this.queuedSpeechText);
        if (!this.aiTranscript && isDirectScriptedSpeech) {
          this.aiTranscript = this.queuedSpeechText;
          this.queuedSpeechText = '';
        }
        this.aiSpeaking = true;
        if (isDirectScriptedSpeech) {
          this.emit('onState', this.replayingIncompleteAudio ? 'ai-resuming' : 'ai-speaking');
        } else {
          this.clearDeferredAudio();
          this.deferAutonomousPlayback = true;
          this.aiSpeaking = true;
          this.deferredAudioTimer = setTimeout(() => this.releaseDeferredAudio(), this.autonomousPlaybackDelayMs);
        }
        return;
      }
      if (event.type === 'response.output_audio.delta') {
        if (this.suppressingAutonomousReply) return;
        const audio = event.audio || event.delta || '';
        if (audio) {
          const chunk = base64ToBytes(audio);
          if (this.deferAutonomousPlayback) this.deferredAudioChunks.push(chunk);
          else this.player.enqueue(chunk).catch(error => this.emit('onError', error.message));
        }
        return;
      }
      if (event.type === 'response.output_audio.done') {
        if (this.suppressingAutonomousReply) return;
        if (this.deferAutonomousPlayback) this.deferredAudioEnded = true;
        else this.player.markTurnEnded();
        return;
      }
      if (event.type === 'response.done') {
        if (this.finishSuppressedReply()) return;
        this.markAiResponseFinished();
        return;
      }
      if (event.type === 'response.canceled') {
        if (this.finishSuppressedReply()) return;
        if (this.aiFinishFallbackTimer) clearTimeout(this.aiFinishFallbackTimer);
        this.aiFinishFallbackTimer = null;
        if (this.aiDrainFallbackTimer) clearTimeout(this.aiDrainFallbackTimer);
        this.aiDrainFallbackTimer = null;
        this.clearDeferredAudio();
        this.player.stop();
        this.syncAiTranscript(Number.POSITIVE_INFINITY, true);
        this.aiSpeaking = false;
        this.aiTurnPrepared = false;
        this.emit('onState', 'listening');
        this.emit('onTurnDone', { canceled: true });
        return;
      }
      if (event.type === 'response.function_call_arguments.done') {
        const items = Array.isArray(event.items) ? event.items : event.items ? [event.items] : [];
        const toolResults = [];
        for (const item of items) {
          const name = item.name || item.function?.name;
          const rawArguments = item.arguments || item.function?.arguments || '{}';
          if (name !== 'render_bilingual_caption') continue;
          try {
            const caption = typeof rawArguments === 'string' ? JSON.parse(rawArguments) : rawArguments;
            if (caption?.english && caption?.chinese) this.emit('onBilingualCaption', caption);
            toolResults.push({
              call_id: item.call_id,
              role: 'tool',
              content: [{ type: 'input_text', text: 'The bilingual caption was displayed successfully.' }]
            });
          } catch (error) {
            this.emit('onError', `中英字幕解析失败：${error.message}`);
          }
        }
        if (toolResults.length) this.send({ type: 'conversation.item.create', items: toolResults });
        return;
      }
      if (event.type === 'session.closed') this.disconnect();
    }

    async disconnect() {
      this.closingByUser = true;
      if (this.suppressedReplyFallbackTimer) clearTimeout(this.suppressedReplyFallbackTimer);
      this.suppressedReplyFallbackTimer = null;
      this.suppressNextAutonomousReply = false;
      this.suppressingAutonomousReply = false;
      if (this.audioRetryTimer) clearTimeout(this.audioRetryTimer);
      this.audioRetryTimer = null;
      this.stopFramePump();
      if (this.sessionCreated) this.send({ type: 'session.close' });
      this.socket?.close(1000, 'user ended call');
      this.socket = null;
      this.stream?.getTracks().forEach(track => track.stop());
      this.stream = null;
      if (this.processor) this.processor.onaudioprocess = null;
      this.processor?.disconnect();
      this.inputSource?.disconnect();
      this.silentGain?.disconnect();
      if (this.inputContext && this.inputContext.state !== 'closed') await this.inputContext.close().catch(() => {});
      this.inputContext = null;
      await this.player.close();
      this.connected = false;
      this.sessionCreated = false;
      this.emit('onState', 'closed');
    }
  }

  window.LindseyRealtimeVoice = LindseyRealtimeVoice;
})();
