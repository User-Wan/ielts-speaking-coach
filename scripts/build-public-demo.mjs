import { promises as fs } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const output = path.resolve(process.env.PUBLIC_DEMO_OUTPUT || path.join(root, "_site"))
const dashboard = await fs.readFile(path.join(root, "demo", "dashboard.html"), "utf8")
const sampleData = await fs.readFile(path.join(root, "demo", "sample-data.json"), "utf8")

const publicCss = `
    .public-demo-banner { position: sticky; top: 0; z-index: 30; display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 9px 16px; color: #173d36; background: #e8f2d8; border-bottom: 1px solid #cbdcae; font-size: 11px; font-weight: 700; }
    .public-demo-banner small { color: #52766b; font-weight: 600; }
    body.public-demo .desktop-console { border-color: #cbdcae; background: linear-gradient(135deg, #f7fbef 0%, #eef5e3 100%); }
    body.public-demo .desktop-console small { color: #28705f; }
    body.public-demo .desktop-action:disabled, body.public-demo .route-button:disabled, body.public-demo .bank-use:disabled { opacity: .62; cursor: not-allowed; }
`

const adapter = `<script>
  window.__IELTS_PUBLIC_DEMO__ = true;
  window.__IELTS_PUBLIC_DEMO_DATA__ = null;
  window.__IELTS_PUBLIC_DEMO_READY__ = fetch('./sample-data.json', { cache: 'no-store' }).then((response) => {
    if (!response.ok) throw new Error('Public sample data could not be loaded');
    return response.json();
  }).then((data) => { window.__IELTS_PUBLIC_DEMO_DATA__ = data; return data; });
  const __publicDemoFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const requestUrl = typeof input === 'string' ? input : input?.url || '';
    const pathname = new URL(requestUrl, window.location.href).pathname;
    if (pathname.endsWith('/api/dashboard')) {
      const data = await window.__IELTS_PUBLIC_DEMO_READY__;
      return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (pathname.includes('/api/')) {
      return new Response(JSON.stringify({ error: 'This is a read-only public demo. Use the desktop app for local training and saving.' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }
    return __publicDemoFetch(input, init);
  };
</script>`

const footerScript = `<script>
  document.body.classList.add('public-demo');
  const banner = document.createElement('div');
  banner.className = 'public-demo-banner';
  banner.innerHTML = '<span>PUBLIC DEMO · SAMPLE DATA · READ ONLY</span><small>ChatGPT, recording, saving and export are available in the desktop app.</small>';
  document.body.prepend(banner);
  const desktopOnlySelector = '#open-chatgpt, #finish-recording, #copy-review-prompt, #open-associated-conversation, #recover-review, #recording-enabled, #export-daily-teacher, #open-teacher-export, #save-selection, #start-topic-retrain, #start-retrain, #create-plan, #save-plan, #add-vocab-note, #profile-entry, #profile-inline-entry, [data-issue-status], [data-note-archive], [data-note-restore], [data-retrain-question]';
  const disableDesktopOnlyControls = () => document.querySelectorAll(desktopOnlySelector).forEach((element) => {
    element.disabled = true;
    element.title = 'Available in the desktop app';
  });
  disableDesktopOnlyControls();
  new MutationObserver(disableDesktopOnlyControls).observe(document.body, { childList: true, subtree: true });
</script>`

const withStyles = dashboard.replace("</style>", `${publicCss}\n</style>`)
const html = withStyles.replace("<body>", `<body>\n${adapter}`).replace("</body>", `${footerScript}\n</body>`)

await fs.mkdir(output, { recursive: true })
await fs.writeFile(path.join(output, "index.html"), html, "utf8")
await fs.writeFile(path.join(output, "sample-data.json"), sampleData, "utf8")
await fs.writeFile(path.join(output, ".nojekyll"), "", "utf8")

const forbidden = [/state\.json/i, /C:\\\\Users/i, /E:\\\\/i, /chatgpt\.com/i]
const generated = await fs.readFile(path.join(output, "index.html"), "utf8")
const generatedSampleData = await fs.readFile(path.join(output, "sample-data.json"), "utf8")
for (const pattern of forbidden) {
  if (pattern.test(generated) || pattern.test(generatedSampleData)) throw new Error(`Public demo contains forbidden reference: ${pattern}`)
}
console.log(`Built public demo at ${output}`)
