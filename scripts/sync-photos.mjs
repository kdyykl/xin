// 把阿里云 OSS 里的照片同步成站点自带的静态镜像：
//   - photos/YYYY-MM-DD.jpg        （压缩后，最长边 1400px）
//   - photos.json                  （日期 -> 相对路径，页面在 OSS 连不上时回退使用）
//   - photos/.mirror-state.json    （日期 -> 源文件名，用来判断同一天是否有新上传）
// 由 .github/workflows/pages.yml 在每次部署/定时任务里调用。
//
// OSS Bucket 需要是「公共读」，才能在这里匿名列举和下载。
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const OSS_BASE = process.env.OSS_BASE || 'https://kdyykl-xin-photos.oss-cn-guangzhou.aliyuncs.com';
const OSS_PREFIX = process.env.OSS_PREFIX || 'photos/';
const DRY = process.env.DRY === '1';

const PHOTO_DIR = 'photos';
const MANIFEST = 'photos.json';
const STATE = PHOTO_DIR + '/.mirror-state.json';
const MAX_SIZE = 1400;
const QUALITY = 80;

// 列举 OSS 上的所有照片文件名（不含 photos/ 前缀）
async function listAll() {
  const all = [];
  let token = null;
  for (let page = 0; page < 20; page++) {
    const u = new URL(OSS_BASE + '/');
    u.searchParams.set('list-type', '2');
    u.searchParams.set('prefix', OSS_PREFIX);
    u.searchParams.set('max-keys', '1000');
    if (token) u.searchParams.set('continuation-token', token);
    const res = await fetch(u, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error('OSS list HTTP ' + res.status);
    const xml = await res.text();
    for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const km = m[1].match(/<Key>([^<]+)<\/Key>/);
      if (!km) continue;
      const key = km[1];
      const name = key.indexOf(OSS_PREFIX) === 0 ? key.slice(OSS_PREFIX.length) : key;
      all.push(name);
    }
    if (!/<IsTruncated>true<\/IsTruncated>/.test(xml)) break;
    const tm = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);
    if (!tm) break;
    token = tm[1];
  }
  return all;
}

// 同一天多次上传时，文件名里带 _<毫秒时间戳> 的是后传的，取最新
function pickLatest(names) {
  const score = name => {
    const m = name.match(/_(\d{13})\./);
    return m ? Number(m[1]) : 0;
  };
  return [...names].sort((a, b) => score(b) - score(a) || a.localeCompare(b))[0];
}

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; }
}

async function main() {
  const names = await listAll();
  const byDate = {};
  for (const name of names) {
    const m = name.match(/^(\d{4}-\d{2}-\d{2})(?:_(\d+))?\.(jpe?g|png|gif|webp)$/i);
    if (!m) continue; // 忽略非照片文件
    (byDate[m[1]] = byDate[m[1]] || []).push(name);
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
    const url = OSS_BASE + '/' + OSS_PREFIX + encodeURIComponent(item.fileName);
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
