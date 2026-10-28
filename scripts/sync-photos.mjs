// 把 Supabase Storage 里的照片同步成站点自带的静态镜像：
//   - photos/YYYY-MM-DD.jpg        （压缩后，最长边 1400px）
//   - photos.json                  （日期 -> 相对路径，页面在 Supabase 连不上时回退使用）
//   - photos/.mirror-state.json    （日期 -> 源文件名，用来判断同一天是否有新上传）
// 由 .github/workflows/pages.yml 在每次部署/定时任务里调用。
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON = process.env.SUPABASE_ANON;
if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error('缺少环境变量 SUPABASE_URL / SUPABASE_ANON');
  process.exit(1);
}
const DRY = process.env.DRY === '1';

const PHOTO_DIR = 'photos';
const MANIFEST = 'photos.json';
const STATE = PHOTO_DIR + '/.mirror-state.json';
const MAX_SIZE = 1400;
const QUALITY = 80;

async function listAll() {
  const all = [];
  let offset = 0;
  while (true) {
    const res = await fetch(SUPABASE_URL + '/storage/v1/object/list/photos', {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: 'Bearer ' + SUPABASE_ANON,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ prefix: '', limit: 1000, offset }),
      signal: AbortSignal.timeout(30000)
    });
    if (!res.ok) throw new Error('list HTTP ' + res.status);
    const data = await res.json();
    all.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  return all;
}

// 同一天多次上传时，文件名里带 _<毫秒时间戳> 的是后传的，取最新
function pickLatest(files) {
  const score = name => {
    const m = name.match(/_(\d{13})\./);
    return m ? Number(m[1]) : 0;
  };
  return [...files].sort((a, b) => score(b.name) - score(a.name) || a.name.localeCompare(b.name))[0].name;
}

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; }
}

async function main() {
  const objects = await listAll();
  const byDate = {};
  for (const obj of objects) {
    const m = obj.name && obj.name.match(/^(\d{4}-\d{2}-\d{2})/);
    if (!m) continue; // 忽略 _dsh_diag_test.txt 之类的非照片文件
    (byDate[m[1]] = byDate[m[1]] || []).push(obj);
  }

  if (!DRY) fs.mkdirSync(PHOTO_DIR, { recursive: true });
  let manifest = readJSON(MANIFEST, {});
  let state = readJSON(STATE, {});

  const dates = Object.keys(byDate).sort();
  const todo = [];
  for (const date of dates) {
    const fileName = pickLatest(byDate[date]);
    const relPath = `${PHOTO_DIR}/${date}.jpg`;
    if (manifest[date] === relPath && state[date] === fileName && fs.existsSync(relPath)) continue;
    todo.push({ date, fileName, relPath });
  }
  console.log(`共 ${dates.length} 个日期，需要新增/更新 ${todo.length} 张`);
  if (DRY) {
    console.log('DRY 模式只检查，不下载。示例:', todo.slice(0, 5).map(t => t.date + ' <- ' + t.fileName));
    return;
  }

  let done = 0;
  for (const item of todo) {
    const url = SUPABASE_URL + '/storage/v1/object/public/photos/' + encodeURIComponent(item.fileName);
    const res = await fetch(url, { signal: AbortSignal.timeout(180000) });
    if (!res.ok) throw new Error(`download ${item.fileName} HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const tmp = `${PHOTO_DIR}/.tmp-${item.date}.bin`;
    fs.writeFileSync(tmp, buf);
    try {
      execFileSync('convert', [tmp, '-auto-orient', '-resize', `${MAX_SIZE}x${MAX_SIZE}>`, '-strip', '-quality', String(QUALITY), item.relPath]);
    } finally {
      fs.rmSync(tmp, { force: true });
    }
    manifest[item.date] = item.relPath;
    state[item.date] = item.fileName;
    done++;
    console.log(`[${done}/${todo.length}] ${item.date} <- ${item.fileName}`);
  }

  // 清掉已经不存在的旧条目（照片被删/改名）
  for (const date of Object.keys(manifest)) {
    if (!fs.existsSync(manifest[date])) { delete manifest[date]; delete state[date]; }
  }
  for (const date of Object.keys(state)) {
    if (!byDate[date]) delete state[date];
  }

  const sortedManifest = {};
  for (const k of Object.keys(manifest).sort()) sortedManifest[k] = manifest[k];
  fs.writeFileSync(MANIFEST, JSON.stringify(sortedManifest, null, 2) + '\n');
  const sortedState = {};
  for (const k of Object.keys(state).sort()) sortedState[k] = state[k];
  fs.writeFileSync(STATE, JSON.stringify(sortedState, null, 2) + '\n');
  console.log(`镜像完成：日期 ${dates.length} 个，本次处理 ${done} 张`);
}

main().catch(e => { console.error('同步失败:', e); process.exit(1); });
