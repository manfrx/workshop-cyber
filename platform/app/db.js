/*
 * Armazenamento simples em JSON (um processo, baixa concorrência = suficiente
 * para o workshop). Guarda usuários, veredictos da quest de phishing e flags
 * resolvidas. Senhas com scrypt (sem dependência nativa).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'db.json');

// --- regras de pontuação ---
const POINTS_CORRECT = 10;
const POINTS_WRONG = -5;

// decaimento das flags por ordem de resolução:
// o 1º a resolver leva FLAG_BASE; cada solver seguinte perde FLAG_STEP,
// respeitando o piso FLAG_FLOOR. Ex.: 100, 90, 80, 70, 60, 50, 50, ...
const FLAG_BASE = 100;
const FLAG_STEP = 10;
const FLAG_FLOOR = 50;

// pontos que o PRÓXIMO solver (o de índice `rank`, começando em 0) recebe.
function flagAward(rank) {
  return Math.max(FLAG_FLOOR, FLAG_BASE - rank * FLAG_STEP);
}

// flags válidas dos cenários 1 e 2 (unificado no placar)
// Vêm do ambiente (C1_FLAG / C2_FLAG): nunca hardcoded no repositório.
// Se a variável não estiver definida, o cenário correspondente não pontua.
const FLAGS = {};
for (const [id, label, value] of [
  ['challenge1', 'Cenário 1 · SQL Injection', process.env.C1_FLAG],
  ['challenge2', 'Cenário 2 · Command Injection', process.env.C2_FLAG],
]) {
  if (value) FLAGS[value] = { id, label };
}
if (!Object.keys(FLAGS).length) {
  console.warn('[db] C1_FLAG/C2_FLAG não definidas — nenhuma flag será aceita.');
}

let data = { users: {}, verdicts: {}, flags: {}, settings: {} };

function load() {
  try {
    if (fs.existsSync(DB_FILE)) data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) { console.error('db load:', e.message); }
  data.users = data.users || {};
  data.verdicts = data.verdicts || {};
  data.flags = data.flags || {};
  data.settings = data.settings || {};
}
function save() {
  try {
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, DB_FILE);
  } catch (e) { console.error('db save:', e.message); }
}

// --- usuários ---
function hashPw(pw, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex');
  return { salt, hash };
}
function normUser(u) { return String(u || '').trim().toLowerCase(); }

function createUser(username, name, password) {
  const u = normUser(username);
  if (!u || !password || !name) return { error: 'Preencha usuário, nome e senha.' };
  if (!/^[a-z0-9._-]{3,20}$/.test(u)) return { error: 'Usuário: 3–20 caracteres (letras, números, . _ -).' };
  if (password.length < 4) return { error: 'Senha muito curta (mínimo 4).' };
  if (data.users[u]) return { error: 'Esse usuário já existe. Faça login.' };
  const { salt, hash } = hashPw(password);
  data.users[u] = { username: u, name: String(name).trim().slice(0, 40), salt, hash, createdAt: Date.now() };
  save();
  return { user: data.users[u] };
}
function verifyUser(username, password) {
  const u = normUser(username);
  const rec = data.users[u];
  if (!rec) return null;
  const { hash } = hashPw(password, rec.salt);
  const a = Buffer.from(hash, 'hex'), b = Buffer.from(rec.hash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return rec;
}
function getUser(username) { return data.users[normUser(username)] || null; }

// --- veredictos da quest ---
function getClassifiedIds(username) {
  const v = data.verdicts[normUser(username)] || {};
  return Object.keys(v).map(Number);
}
function recordVerdict(username, emailId, guess, correctCategory) {
  const u = normUser(username);
  data.verdicts[u] = data.verdicts[u] || {};
  if (data.verdicts[u][emailId]) return { already: true };   // não reclassifica
  const correct = guess === correctCategory;
  const points = correct ? POINTS_CORRECT : POINTS_WRONG;
  data.verdicts[u][emailId] = { guess, correct, points, at: Date.now() };
  save();
  return { ok: true };
}

// --- flags ---
function getSolvedFlags(username) {
  return data.flags[normUser(username)] || {};   // { challenge1: {label,points,at}, ... }
}
// quantos participantes já resolveram esta flag (define a ordem/decaimento)
function flagSolveCount(flagId) {
  let n = 0;
  for (const u of Object.keys(data.flags)) if (data.flags[u][flagId]) n++;
  return n;
}
// quanto vale a flag para o PRÓXIMO que resolvê-la agora
function nextFlagPoints(flagId) {
  return flagAward(flagSolveCount(flagId));
}
function submitFlag(username, flagStr) {
  const u = normUser(username);
  const f = FLAGS[String(flagStr || '').trim()];
  if (!f) return { error: 'Flag inválida.' };
  data.flags[u] = data.flags[u] || {};
  if (data.flags[u][f.id]) return { already: true, label: f.label };
  const rank = flagSolveCount(f.id);          // 0 = primeiro a resolver
  const points = flagAward(rank);             // decai conforme a ordem
  data.flags[u][f.id] = { label: f.label, points, rank, at: Date.now() };
  save();
  return { ok: true, label: f.label, points, rank };
}

// --- liberação do Cenário 3 (caixa de entrada) pelo instrutor ---
function isMailUnlocked() { return !!data.settings.mailUnlocked; }
function setMailUnlocked(on) { data.settings.mailUnlocked = !!on; save(); }

// --- reset do placar (instrutor) ---
// zera participantes, veredictos e flags. Mantém as settings (ex.: mailUnlocked).
// Retorna quantos participantes foram removidos.
function resetDashboard() {
  const n = Object.keys(data.users).length;
  data.users = {};
  data.verdicts = {};
  data.flags = {};
  save();
  return n;
}

// --- placar ---
function scoreOf(username) {
  const u = normUser(username);
  const v = data.verdicts[u] || {};
  let phishing = 0, classified = 0, hits = 0;
  for (const k of Object.keys(v)) { phishing += v[k].points; classified++; if (v[k].correct) hits++; }
  const solved = data.flags[u] || {};
  let flagPts = 0; for (const k of Object.keys(solved)) flagPts += solved[k].points;
  return { phishing, classified, hits, flags: Object.keys(solved).length, flagPts, total: phishing + flagPts };
}
function getScores() {
  return Object.values(data.users).map(user => {
    const s = scoreOf(user.username);
    return { username: user.username, name: user.name, ...s };
  }).sort((a, b) => b.total - a.total || b.hits - a.hits);
}

load();
module.exports = {
  FLAGS, POINTS_CORRECT, POINTS_WRONG,
  FLAG_BASE, FLAG_STEP, FLAG_FLOOR,
  createUser, verifyUser, getUser,
  getClassifiedIds, recordVerdict,
  getSolvedFlags, submitFlag, flagSolveCount, nextFlagPoints,
  getScores, scoreOf,
  isMailUnlocked, setMailUnlocked, resetDashboard,
};
