import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.TEACHING_LAB_PORT || 4174);
const model = process.env.OPENAI_MODEL || 'gpt-5.6-terra';

const send = (res, status, body, type = 'application/json; charset=utf-8') => {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};

const readJson = async (req) => {
  let raw = '';
  for await (const part of req) raw += part;
  return JSON.parse(raw || '{}');
};

const extractText = (response) => response.output
  ?.flatMap((item) => item.content || [])
  .filter((item) => item.type === 'output_text')
  .map((item) => item.text)
  .join('\n') || '我没有收到可用回复，请再试一次。';

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    return send(res, 200, { ok: true, model, apiKeyConfigured: Boolean(process.env.OPENAI_API_KEY) });
  }

  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    const html = await readFile(join(here, 'teaching-lab-v1.html'), 'utf8');
    return send(res, 200, html, 'text/html; charset=utf-8');
  }

  if (req.method !== 'POST' || req.url !== '/api/coach') return send(res, 404, { error: 'Not found' });
  if (!process.env.OPENAI_API_KEY) return send(res, 503, { error: '还没有配置 OPENAI_API_KEY。页面已就绪，但暂时不能连接真实模型。' });

  try {
    const payload = await readJson(req);
    const studentText = String(payload.studentText || '').trim();
    if (!studentText) return send(res, 400, { error: '请输入学生刚刚说的话。' });

    const rules = await readFile(join(here, 'teaching-rules-v1.md'), 'utf8');
    const course = payload.course || {};
    const history = Array.isArray(payload.history) ? payload.history.slice(-8) : [];
    const context = {
      part: course.part || 'Part 3',
      question: course.question || '',
      highScoreAnswer: course.highScoreAnswer || '',
      completionStandard: course.completionStandard || '',
      currentStep: course.currentStep || '',
      studentText,
      recentTurns: history,
    };

    const apiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        instructions: rules,
        input: `本节课上下文：\n${JSON.stringify(context, null, 2)}\n\n请根据规则，给出现在教练应该说的下一句话。`,
        reasoning: { effort: 'low' },
        text: { verbosity: 'low' },
        store: false,
      }),
    });
    const result = await apiResponse.json();
    if (!apiResponse.ok) return send(res, apiResponse.status, { error: result.error?.message || '模型请求失败。' });
    return send(res, 200, { reply: extractText(result), model: result.model || model });
  } catch (error) {
    return send(res, 500, { error: error instanceof Error ? error.message : '服务器发生错误。' });
  }
});

server.listen(port, () => console.log(`Teaching Lab: http://localhost:${port}`));
