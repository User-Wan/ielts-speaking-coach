import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

async function loadFlow() {
  const source = await readFile(new URL('./teaching-flow-social-media-v1.js', import.meta.url), 'utf8');
  const context = { window: {} };
  vm.runInNewContext(source, context);
  return context.window.LindseyTeachingFlow;
}

test('the first entry introduces Lindsey and today\'s lesson in English', async () => {
  const flow = await loadFlow();
  assert.match(flow.opening.spokenEn, /I\u2019m Lindsey/i);
  assert.match(flow.opening.spokenEn, /Today/i);
  assert.match(flow.opening.spokenEn, /By the end of this lesson/i);
  assert.match(flow.opening.spokenEn, /Are you ready to listen\?/i);
  assert.equal('topicChatQuestionEn' in flow.opening, false);
  assert.equal('topicChatQuestionZh' in flow.opening, false);
  assert.doesNotMatch(flow.opening.spokenEn, /[\u3400-\u9fff]/u);
});

test('every spoken stage instruction and praise is English-only', async () => {
  const flow = await loadFlow();
  for (const [index, stage] of flow.stages.entries()) {
    assert.ok(stage.coachEn, `stage ${index + 1} is missing coachEn`);
    assert.doesNotMatch(stage.coachEn, /[\u3400-\u9fff]/u, `stage ${index + 1} contains spoken Chinese`);
  }
  for (const [index, sentence] of flow.sentences.entries()) {
    assert.ok(sentence.praiseEn, `sentence ${index + 1} is missing praiseEn`);
    assert.doesNotMatch(sentence.praiseEn, /[\u3400-\u9fff]/u, `sentence ${index + 1} praise contains spoken Chinese`);
  }
});

test('the full lesson contract includes chat, follow mode and language transfer', async () => {
  const flow = await loadFlow();
  assert.equal('topicChatQuestionEn' in flow.opening, false);
  assert.equal(flow.followMode, 'full-sentence');
  assert.ok(flow.languageTakeaway.phrase);
  assert.equal(flow.stages.length, 9);
  assert.equal(flow.sentences.length, 6);
  for (const sentence of flow.sentences) assert.equal((sentence.en.match(/[.!?]/g) || []).length, 1);
  assert.equal(flow.stages[2].listeningRetell, true);
  assert.equal(flow.stages[2].name, '精听复述');
});

test('the classroom UI separates conversation, task guidance and lesson material', async () => {
  const html = await readFile(new URL('./voice-room-desktop-v5.html', import.meta.url), 'utf8');
  assert.match(html, /id="messages"/);
  assert.match(html, /id="liveCaption"/);
  assert.match(html, /id="materialPanel"/);
  assert.match(html, /onBilingualCaption/);
  assert.match(html, /setActiveMaterialSentence/);
  assert.doesNotMatch(html, /addMessage\('ai',flow\.opening\.spokenEn/);
  assert.match(html, /prepareScriptedSentenceSequence\('opening'/);
  assert.match(html, /voice-signal/);
  assert.match(html, /item\.speaking/);
  assert.match(html, /parseEnglishSentences/);
  assert.match(html, /updateCoachPanel/);
  assert.match(html, /const phases = \[/);
  assert.match(html, /title:'听懂'/);
  assert.match(html, /title:'跟熟'/);
  assert.match(html, /title:'组织'/);
  assert.match(html, /title:'说出'/);
  assert.match(html, /const actionTitles = \[/);
  assert.match(html, /现在要做/);
  assert.match(html, /你也可以直接说/);
  assert.match(html, /function confirmReady\(fromVoice=false,forceCommit=false\)/);
  assert.match(html, /function readinessPhrase\(text\)/);
  assert.match(html, /Great\. Let\\u2019s begin\./);
  assert.match(html, /function startAnswerCountdown\(\)/);
  assert.match(html, /let topicChatPhase='inactive'/);
  assert.match(html, /function topicWaitingForLearner\(\)/);
  assert.match(html, /function topicFinalAnswer\(\)/);
  assert.match(html, /interactionMode:finalTopicAnswer\?'topic-chat-closing'/);
  assert.doesNotMatch(html, /topicChatPhase='asking-second'/);
  assert.match(html, /materialRevealed=true;render\(\);voice\.updateLesson\(lessonContext\(\)\);startFollowCountdown\(\)/);
  assert.match(html, /generating and validating one acknowledgement plus one dynamic follow-up question as structured JSON/);
  assert.match(html, /speak only that exact text and append nothing/);
  assert.match(html, /speakingStyle/);
  assert.match(html, /step=1;sentenceIndex=0/);
  assert.match(html, /skipFullAnswerAvailable=true/);
  assert.match(html, /跳过本次朗读/);
  assert.match(html, /function finishSkipFullAnswer\(\)/);
  assert.match(html, /if\(skipFullAnswerRequested\)\{finishSkipFullAnswer\(\);return\}/);
  assert.match(html, /skipFullAnswerTimer=setTimeout\(finishSkipFullAnswer,900\)/);
  assert.match(html, /function beginTopicChat\(\)/);
  assert.match(html, /const directTopicStart=pageParams\.get\('start'\)==='topic'/);
  assert.match(html, /if\(directTopicStart\|\|selfTestStage==='topic'\)/);
  assert.match(html, /从自由对话开始/);
  assert.match(html, /正在根据今天的题目生成自然的开场问题/);
  assert.match(html, /if\(topicChatActive\(\)\)\{voice\.commitAudio\(\)/);
  assert.match(html, /function startFollowCountdown\(\)/);
  assert.match(html, /不需要确认，3、2、1 后直接开始第一句/);
  assert.match(html, /enterFollowReadiness\(\).*startFollowCountdown\(\)/s);
  assert.match(html, /function materialPauseMs\(index\)/);
  assert.match(html, /return 2300/);
  assert.match(html, /return 1800/);
  assert.match(html, /function startMaterialSequence\(\)/);
  assert.match(html, /scriptedMode='material-pause'/);
  assert.doesNotMatch(html, /固定九步/);
  assert.doesNotMatch(html, /updateLiveCoachSubtitle|hideLiveCoachSubtitle/);

  const voiceClient = await readFile(new URL('./realtime-voice-client.js', import.meta.url), 'utf8');
  assert.match(voiceClient, /syncAiTranscript/);
  assert.match(voiceClient, /finishTurnIfIdle/);
  assert.match(voiceClient, /onIdle: \(\) => this\.markAiPlaybackFinished\(\)/);
  assert.match(voiceClient, /event\.type === 'response\.done'/);
  assert.match(voiceClient, /!this\.aiPlaybackFinished \|\| !this\.aiResponseFinished/);
  assert.match(voiceClient, /remainingPlaybackMs\(\)/);
  assert.match(voiceClient, /PLAYBACK_START_BUFFER_MS = 240/);
  assert.match(voiceClient, /PLAYBACK_RESUME_BUFFER_MS = 180/);
  assert.match(voiceClient, /this\.pendingBuffers\.length \|\| this\.sources\.size/);
  assert.match(voiceClient, /const activeInputContext = this\.inputContext/);
  assert.match(voiceClient, /if \(!activeInputContext \|\| activeInputContext\.state === 'closed'\) return/);
  assert.match(voiceClient, /this\.processor\.onaudioprocess = null/);
  assert.match(voiceClient, /setMicrophoneInputEnabled\(enabled\)/);
  assert.match(voiceClient, /!this\.microphoneInputEnabled && event\.type\.startsWith\('conversation\.item\.input_audio_transcription\.'\)/);
  assert.match(html, /voice\.setMicrophoneInputEnabled\(false\);\s*const openingFirst=prepareScriptedSentenceSequence\('opening'/);
  assert.match(html, /if\(scriptedMode==='opening'\)\{\s*voice\.setMicrophoneInputEnabled\(true\)/);
  assert.doesNotMatch(voiceClient, /Math\.ceil\(this\.player\.remainingPlaybackMs\(\)\) \+ 180/);
  assert.match(voiceClient, /this\.player\.playedSeconds \+ 0\.08 < minimumAudioSeconds/);
  assert.match(voiceClient, /onUserTurnDone/);
  assert.match(voiceClient, /onUserFinalText/);
  assert.match(html, /function rollingUserCaption\(text,maxWords=12\)/);
  assert.match(html, /updateUserTurnCard\(readyDetected\?readyCaptionText\(text\):text\)/);
  assert.doesNotMatch(html, /nativeTurnFallback|scheduleNativeTurnFallback|clearNativeTurnFallback/);
  assert.match(html, /function composeUserAnswer\(liveText=''\)/);
  assert.match(html, /function closeUserTurnCard\(\)/);
  assert.match(html, /closeUserTurnCard\(\);/);
  assert.match(html, /endSmoothWindowMs=topicChatActive\(\)\?3200:recallMode\?1500:echoMode\?1100/);
  assert.match(html, /interactionMode:finalTopicAnswer\?'topic-chat-closing':topicChatActive\(\)\?'topic-chat':recallMode\?'listening-retell':echoMode\?'echo-repeat'/);
  assert.match(html, /Ready for listening recall\?/);
  assert.match(html, /showReadyGate\('recall'\)/);
  assert.match(html, /function startListeningRetellUnit\(text,zh=''\)/);
  assert.match(html, /function revealListeningTarget\(\)/);
  assert.match(html, /chat-message\.concealed/);
  assert.match(html, /if\(stage\.listeningRetell\)startListeningRetellUnit\(text,zh\)/);
  assert.match(html, /followSelfTests\.includes\(selfTestStage\)\?1:0/);
  assert.match(html, /if\(selfTestStage\)\{/);
  assert.match(html, /practiceSentenceComplete\(text\)/);
  assert.match(html, /voice\.suppressNextResponse\(\)/);
  assert.match(html, /Mm-hm, keep going\./);
  assert.match(html, /function startLearnerReplyWindow\(\)/);
  assert.match(html, /topicLesson\.endSmoothWindowMs=3200/);
  assert.match(html, /topicChatPhase==='waiting-first'\)topicChatPhase='responding-first'/);
  assert.match(html, /topicChatPhase==='waiting-second'\)topicChatPhase='responding-second'/);
  assert.match(html, /翻译生成中…/);
  assert.match(html, /Use native full-duplex turn-taking/);
  assert.match(html, /\.reply-assist\{position:relative/);
  assert.match(html, /replyAssistTimer=setTimeout/);
  assert.match(html, /},7000\)/);
  assert.match(html, /},13000\)/);
  assert.match(html, /function skipTopicQuestion\(\)/);
  assert.doesNotMatch(html, /By the way, do you ever open one of those apps/);
  assert.match(html, /fetch\('\/api\/topic-chat-turn'/);
  assert.match(html, /function maybeStartStructuredTopicReply\(\)/);
  assert.match(html, /voice\.suppressNextResponse\(1600\)/);
  assert.match(html, /startScriptedSentenceSequence\('topic-first-structured'/);
  assert.match(html, /startScriptedSentenceSequence\('topic-second-structured'/);
  assert.match(html, /selfTestStage==='structured-topic-json'/);
  assert.match(html, /scriptedMode==='topic-first-structured'\)\{scriptedMode=null;topicChatPhase='waiting-second';startLearnerReplyWindow\(\)/);
  assert.match(html, /function discardInterruptedAiTurn\(\)/);
  assert.match(html, /item\.canceled\?'':item\.type==='event'/);
  assert.match(html, /topicWaitingForLearner\(\)&&!scriptedMode/);
  assert.match(html, /scriptedMode='sentence-breath'/);
  assert.match(html, /},900\)/);
  assert.match(html, /requestTopicOpeningQuestion\(\)/);
  assert.match(html, /fetch\('\/api\/topic-opening-question'/);
  assert.match(html, /const topicFirst=prepareScriptedSentenceSequence\('question',opening\.english,opening\.chinese\)/);
  assert.match(html, /greeting:topicFirst\.en/);
  assert.match(html, /completeLearnerAction\(true\)/);
  assert.doesNotMatch(html, /const keepBlurred=/);
  assert.match(html, /addMessage\('ai',sentence,zh\|\|'翻译生成中…',!zh,false\)/);
  assert.match(html, /updateMessage\(activeAiCardIndex,\{en:sentence,zh:zh\|\|dialogueLog\[activeAiCardIndex\]\.zh\|\|'翻译生成中…',pending:!zh,speaking:false\}\)/);
  assert.match(html, /addMessage\('ai',parsed\.remainder,'翻译生成中…',true,true\)/);
  assert.doesNotMatch(html, /if\(!voice\.aiSpeaking\)\{/);
  assert.match(html, /aiTurnPlaybackFinished=false/);
  assert.match(html, /function flushPendingBilingualCaptions\(\)/);
  assert.match(html, /flushPendingBilingualCaptions\(\);/);
  assert.match(html, /onTurnDone:event=>\{\s*aiTurnPlaybackFinished=true/);
  assert.match(html, /function prepareScriptedSentenceSequence\(mode,text,zh=''\)/);
  assert.match(html, /function continueScriptedSentenceSequence\(\)/);
  assert.match(html, /if\(scriptedMode&&continueScriptedSentenceSequence\(\)\)return/);
  assert.match(html, /greeting:openingFirst\.en/);
  assert.doesNotMatch(html, /greeting:flow\.opening\.spokenEn/);
  assert.match(html, /onUserFinalText:text=>\{const finalText=readyCaptionLocked\?readyCaptionText\(text\):text;finalizeUserTranscript\(finalText\)/);
});

test('text arriving before audio start is preserved and waits for playback progress', async () => {
  const source = await readFile(new URL('./realtime-voice-client.js', import.meta.url), 'utf8');
  const context = { window: {}, Uint8Array, Int16Array, DataView, Math, JSON, Number, Set, setTimeout, clearTimeout };
  vm.runInNewContext(source, context);
  const spoken = [];
  const voice = new context.window.LindseyRealtimeVoice({ onAiText: text => spoken.push(text) });
  voice.handleMessage(JSON.stringify({ type: 'response.output_text.delta', delta: 'Hi, I\u2019m Lindsey.' }));
  voice.handleMessage(JSON.stringify({ type: 'response.output_audio.started' }));
  assert.equal(voice.aiTranscript, 'Hi, I\u2019m Lindsey.');
  assert.deepEqual(spoken, []);
  voice.syncAiTranscript(1);
  assert.equal(spoken.at(-1), 'Hi, I\u2019m');
  voice.clearDeferredAudio();
});

test('direct TTS uses the locally queued text when the provider returns audio only', async () => {
  const source = await readFile(new URL('./realtime-voice-client.js', import.meta.url), 'utf8');
  const context = { window: {}, Uint8Array, Int16Array, DataView, Math, JSON, Number, Set, WebSocket: { OPEN: 1 }, crypto: { randomUUID: () => 'test-id' } };
  vm.runInNewContext(source, context);
  const spoken = [];
  const voice = new context.window.LindseyRealtimeVoice({ onAiText: text => spoken.push(text) });
  voice.sendText('Hi, I am Lindsey.');
  voice.handleMessage(JSON.stringify({ type: 'response.output_audio.started' }));
  assert.equal(voice.aiTranscript, 'Hi, I am Lindsey.');
  assert.deepEqual(spoken, []);
  voice.syncAiTranscript(1);
  assert.equal(spoken.at(-1), 'Hi, I');
});

test('a sentence advances only after local playback and the upstream response are both finished', async () => {
  const source = await readFile(new URL('./realtime-voice-client.js', import.meta.url), 'utf8');
  const context = { window: {}, Uint8Array, Int16Array, DataView, Math, JSON, Number, Set, setTimeout, clearTimeout };
  vm.runInNewContext(source, context);
  const completed = [];
  const voice = new context.window.LindseyRealtimeVoice({ onTurnDone: event => completed.push(event) });
  voice.prepareAiTurn();
  voice.aiSpeaking = true;
  voice.markAiPlaybackFinished();
  assert.equal(completed.length, 0);
  voice.handleMessage(JSON.stringify({ type: 'response.done' }));
  assert.equal(completed.length, 1);
  assert.equal(completed[0].canceled, false);
});

test('an obviously truncated audio sentence retries instead of advancing the lesson', async () => {
  const source = await readFile(new URL('./realtime-voice-client.js', import.meta.url), 'utf8');
  const context = { window: {}, Uint8Array, Int16Array, DataView, Math, JSON, Number, Set, setTimeout, clearTimeout };
  vm.runInNewContext(source, context);
  const completed = [];
  const retries = [];
  const voice = new context.window.LindseyRealtimeVoice({
    onTurnDone: event => completed.push(event),
    onAudioRetry: event => retries.push(event)
  });
  voice.aiTranscript = 'People use social media because it is useful for learning and communication every day.';
  voice.aiSpeaking = true;
  voice.aiTurnPrepared = true;
  voice.aiPlaybackFinished = true;
  voice.aiResponseFinished = true;
  voice.player.playedSeconds = 0.45;
  voice.finishAiPlayback();
  assert.equal(completed.length, 0);
  assert.equal(retries.length, 1);
  assert.equal(voice.audioRetryCount, 1);
  assert.equal(voice.replayingIncompleteAudio, true);
  clearTimeout(voice.audioRetryTimer);
});

test('every autonomous reply waits and is discarded when the learner resumes speaking', async () => {
  const source = await readFile(new URL('./realtime-voice-client.js', import.meta.url), 'utf8');
  const context = { window: {}, Uint8Array, Int16Array, DataView, Math, JSON, Number, Set, setTimeout, clearTimeout, atob, crypto: { randomUUID: () => 'test-cancel-id' }, WebSocket: { OPEN: 1 } };
  vm.runInNewContext(source, context);
  const states = [];
  const voice = new context.window.LindseyRealtimeVoice({ onState: state => states.push(state) });
  for (let turn = 1; turn <= 3; turn++) {
    voice.handleMessage(JSON.stringify({ type: 'response.output_audio.started' }));
    voice.handleMessage(JSON.stringify({ type: 'response.output_audio.delta', audio: 'AAAA' }));
    assert.equal(voice.deferAutonomousPlayback, true, `turn ${turn} did not defer`);
    assert.equal(voice.deferredAudioChunks.length, 1);
    voice.handleMessage(JSON.stringify({ type: 'conversation.item.input_audio_transcription.started' }));
    assert.equal(voice.deferAutonomousPlayback, false);
    assert.equal(voice.deferredAudioChunks.length, 0);
    assert.equal(voice.aiTurnPrepared, false);
    assert.equal(states.at(-1), 'user-speaking');
  }
  assert.doesNotMatch(states.join(','), /ai-speaking/);
});

test('a learner resuming speech cancels the old reply and keeps the microphone turn active', async () => {
  const source = await readFile(new URL('./realtime-voice-client.js', import.meta.url), 'utf8');
  const sent = [];
  const states = [];
  const context = { window: {}, Uint8Array, Int16Array, DataView, Math, JSON, Number, Set, setTimeout, clearTimeout, WebSocket: { OPEN: 1 }, crypto: { randomUUID: () => 'barge-in-id' } };
  vm.runInNewContext(source, context);
  const voice = new context.window.LindseyRealtimeVoice({ onState: state => states.push(state) });
  voice.socket = { readyState: 1, send: raw => sent.push(JSON.parse(raw)) };
  voice.aiSpeaking = true;
  voice.aiTurnPrepared = true;
  voice.handleMessage(JSON.stringify({ type: 'conversation.item.input_audio_transcription.started' }));
  assert.equal(sent.at(-1).type, 'response.cancel');
  assert.equal(voice.aiSpeaking, false);
  assert.equal(states.at(-1), 'user-speaking');
  voice.handleMessage(JSON.stringify({ type: 'conversation.item.input_audio_transcription.delta', delta: 'I also use it for work.' }));
  assert.equal(voice.userTranscript, 'I also use it for work.');
});

test('scripted opening can mute microphone input without canceling the AI turn', async () => {
  const source = await readFile(new URL('./realtime-voice-client.js', import.meta.url), 'utf8');
  const sent = [];
  const states = [];
  const userText = [];
  const context = { window: {}, Uint8Array, Int16Array, DataView, Math, JSON, Number, Set, WebSocket: { OPEN: 1 }, crypto: { randomUUID: () => 'opening-lock-id' } };
  vm.runInNewContext(source, context);
  const voice = new context.window.LindseyRealtimeVoice({
    onState: state => states.push(state),
    onUserText: text => userText.push(text)
  });
  voice.socket = { readyState: 1, send: raw => sent.push(JSON.parse(raw)) };
  voice.aiSpeaking = true;
  voice.aiTurnPrepared = true;
  voice.setMicrophoneInputEnabled(false);
  voice.handleMessage(JSON.stringify({ type: 'conversation.item.input_audio_transcription.started' }));
  voice.handleMessage(JSON.stringify({ type: 'conversation.item.input_audio_transcription.delta', delta: 'background noise' }));
  assert.equal(voice.aiSpeaking, true);
  assert.equal(sent.some(event => event.type === 'response.cancel'), false);
  assert.deepEqual(states, []);
  assert.deepEqual(userText, []);

  voice.setMicrophoneInputEnabled(true);
  voice.handleMessage(JSON.stringify({ type: 'conversation.item.input_audio_transcription.started' }));
  assert.equal(sent.at(-1).type, 'response.cancel');
  assert.equal(states.at(-1), 'user-speaking');
});

test('echo practice suppresses the model reply before it can repeat the learner sentence', async () => {
  const source = await readFile(new URL('./realtime-voice-client.js', import.meta.url), 'utf8');
  const sent = [];
  const visible = [];
  const completed = [];
  const context = { window: {}, Uint8Array, Int16Array, DataView, Math, JSON, Number, Set, setTimeout, clearTimeout, WebSocket: { OPEN: 1 }, crypto: { randomUUID: () => 'suppress-id' } };
  vm.runInNewContext(source, context);
  const voice = new context.window.LindseyRealtimeVoice({ onAiText: text => visible.push(text), onSuppressedResponseDone: () => completed.push(true) });
  voice.socket = { readyState: 1, send: raw => sent.push(JSON.parse(raw)) };
  voice.suppressNextResponse(5000);
  voice.handleMessage(JSON.stringify({ type: 'response.output_text.delta', delta: 'People in China use social media...' }));
  assert.equal(sent.at(-1).type, 'response.cancel');
  assert.deepEqual(visible, []);
  voice.handleMessage(JSON.stringify({ type: 'response.canceled' }));
  assert.equal(completed.length, 1);
  assert.equal(voice.suppressingAutonomousReply, false);
});

test('a suppressed reply cannot deadlock when the provider omits the cancel confirmation', async () => {
  const source = await readFile(new URL('./realtime-voice-client.js', import.meta.url), 'utf8');
  const completed = [];
  const context = { window: {}, Uint8Array, Int16Array, DataView, Math, JSON, Number, Set, setTimeout, clearTimeout, WebSocket: { OPEN: 1 }, crypto: { randomUUID: () => 'watchdog-id' } };
  vm.runInNewContext(source, context);
  const voice = new context.window.LindseyRealtimeVoice({ onSuppressedResponseDone: () => completed.push(true) });
  voice.socket = { readyState: 1, send: () => {} };
  voice.suppressNextResponse(2000);
  voice.handleMessage(JSON.stringify({ type: 'response.output_text.delta', delta: 'A reply that must be suppressed.' }));
  await new Promise(resolve => setTimeout(resolve, 620));
  assert.equal(completed.length, 1);
  assert.equal(voice.suppressingAutonomousReply, false);
});

test('live user captions merge cumulative and incremental transcript events without truncation', async () => {
  const source = await readFile(new URL('./realtime-voice-client.js', import.meta.url), 'utf8');
  const captions = [];
  const finals = [];
  const context = { window: {}, Uint8Array, Int16Array, DataView, Math, JSON, Number, Set, setTimeout, clearTimeout };
  vm.runInNewContext(source, context);
  const voice = new context.window.LindseyRealtimeVoice({
    onUserText: text => captions.push(text),
    onUserFinalText: text => finals.push(text)
  });
  voice.handleMessage(JSON.stringify({ type: 'conversation.item.input_audio_transcription.started' }));
  voice.handleMessage(JSON.stringify({ type: 'conversation.item.input_audio_transcription.delta', delta: 'I use' }));
  voice.handleMessage(JSON.stringify({ type: 'conversation.item.input_audio_transcription.delta', delta: 'I use WeChat' }));
  voice.handleMessage(JSON.stringify({ type: 'conversation.item.input_audio_transcription.delta', delta: ' every day' }));
  voice.handleMessage(JSON.stringify({ type: 'conversation.item.input_audio_transcription.delta', delta: 'day because it is useful' }));
  assert.deepEqual(captions, ['I', 'I use', 'I use WeChat every']);
  voice.handleMessage(JSON.stringify({
    type: 'conversation.item.input_audio_transcription.completed',
    transcript: 'I use WeChat every day because it is useful'
  }));
  assert.equal(finals.at(-1), 'I use WeChat every day because it is useful');

  voice.handleMessage(JSON.stringify({ type: 'conversation.item.input_audio_transcription.started' }));
  voice.handleMessage(JSON.stringify({ type: 'conversation.item.input_audio_transcription.delta', delta: "I'm ready" }));
  voice.handleMessage(JSON.stringify({ type: 'conversation.item.input_audio_transcription.delta', delta: " I'm ready" }));
  voice.handleMessage(JSON.stringify({ type: 'conversation.item.input_audio_transcription.delta', delta: " I'm ready" }));
  assert.equal(captions.at(-1), "I'm ready");

  // The provider can revise the whole live hypothesis instead of sending only
  // the new suffix. A revision must replace the current caption, not be
  // appended as a second copy of the sentence.
  voice.handleMessage(JSON.stringify({ type: 'conversation.item.input_audio_transcription.started' }));
  const revisionStart = captions.length;
  voice.handleMessage(JSON.stringify({
    type: 'conversation.item.input_audio_transcription.delta',
    delta: "I think it's WeChat and I use it every day"
  }));
  voice.handleMessage(JSON.stringify({
    type: 'conversation.item.input_audio_transcription.delta',
    delta: 'I think it is WeChat, and I use it every day because it helps me'
  }));
  assert.deepEqual(captions.slice(revisionStart), ['I think']);
  assert.doesNotMatch(captions.at(-1), /I think.*I think/i);
  voice.handleMessage(JSON.stringify({
    type: 'conversation.item.input_audio_transcription.delta',
    delta: 'I think it is WeChat, and I use it every day because it helps me study English'
  }));
  assert.equal(captions.at(-1), 'I think it is WeChat, and I use it every day because it helps');

  // A genuine incremental suffix must still extend the current caption.
  voice.handleMessage(JSON.stringify({ type: 'conversation.item.input_audio_transcription.started' }));
  voice.handleMessage(JSON.stringify({
    type: 'conversation.item.input_audio_transcription.delta',
    delta: 'I use WeChat every day'
  }));
  voice.handleMessage(JSON.stringify({
    type: 'conversation.item.input_audio_transcription.delta',
    delta: ' because it helps me'
  }));
  assert.equal(captions.at(-1), 'I use WeChat every');
});

test('topic closing is client-controlled and bilingual captions are matched by English content', async () => {
  const source = await readFile(new URL('./voice-room-desktop-v5.html', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /topicFirstAckPending|topicClosingAckPending|topicFinalizeTimer|topicPendingAnswerText|topicChatAnswers|topicChatClosing|topicChatFinalQuestionArmed|topicChatAwaitingUser|nativeTurnFallback/);
  assert.match(source, /startScriptedSentenceSequence\('topic-bridge','Alright—I’ll read one sentence at a time, and you repeat after me\. Let’s start with the first sentence\.'/);
  assert.match(source, /scriptedMode==='topic-second-structured'\)\{scriptedMode=null;topicChatPhase='bridging';topicChatPauseTimer=setTimeout/);
  assert.doesNotMatch(source, /if\(!scriptedMode&&topicChatPhase==='responding-second'\)/);
  assert.match(source, /function captionTargetIndexes\(english\)/);
  assert.match(source, /tryApplyBilingualCaption\(caption\)/);
  assert.match(source, /translations\.length!==units\.length\?\[\{en:String\(text\|\|''\)\.trim\(\),zh:String\(zh\|\|''\)\.trim\(\)\}\]/);
  assert.match(source, /selfTestStage==='caption-pairing'/);
  assert.doesNotMatch(source, /substantialTopicAnswer|scheduleTopicAnswerFinalization/);
  assert.match(source, /selfTestStage==='topic-question-captions'/);
  assert.match(source, /placeholderTextBefore/);
  assert.doesNotMatch(source, /lastUntranslatedAiCardIndexes\.length\?lastUntranslatedAiCardIndexes:aiTurnCardIndexes/);
});
