// ─── STATE ────────────────────────────────────────────────────────────────────
let authToken = localStorage.getItem('cloudopt_token') || null;
const API = 'http://localhost:3000/api';

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function headers() {
  const h = { 'Content-Type': 'application/json' };
  if (authToken) h['Authorization'] = `Bearer ${authToken}`;
  return h;
}

async function apiCall(method, path, body = null) {
  const opts = { method, headers: headers() };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(`${API}${path}`, opts);
  const data = await resp.json();
  return { ok: resp.ok, status: resp.status, data };
}

function showResult(elementId, result, isAI = false) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.classList.add('visible');

  const statusClass = result.ok ? 'ok' : 'error';
  const statusText = result.ok ? `✅ ${result.status} OK` : `❌ ${result.status} Error`;

  const body = isAI && result.data?.analysis
    ? `<div class="ai-output">${escapeHtml(result.data.analysis)}</div>`
    : isAI && result.data?.advice
    ? `<div class="ai-output">${escapeHtml(result.data.advice)}</div>`
    : isAI && result.data?.recommendation
    ? `<div class="ai-output">${escapeHtml(result.data.recommendation)}</div>`
    : `<pre class="result-body">${JSON.stringify(result.data, null, 2)}</pre>`;

  el.innerHTML = `
    <div class="result-header">
      <span>${method(result)} ${API}${result._path || ''}</span>
      <span class="status-pill ${statusClass}">${statusText}</span>
    </div>
    ${isAI ? `<div style="padding:14px">${body}</div>` : body}
  `;
}

function method(result) { return ''; } // placeholder
function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function setLoading(elementId, msg = 'Loading...') {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.classList.add('visible');
  el.innerHTML = `
    <div class="result-header"><span><span class="spinner">⏳</span> ${msg}</span></div>
    <pre class="result-body">Please wait...</pre>
  `;
}

function updateTokenUI() {
  const el = document.getElementById('tokenStatus');
  if (authToken) {
    el.textContent = '🟢 ' + authToken.substring(0, 20) + '...';
    el.style.color = '#3fb950';
  } else {
    el.textContent = 'Not logged in';
    el.style.color = '';
  }
}

async function updateDataModeBadge() {
  try {
    const r = await fetch(`${API}/health`);
    const d = await r.json();
    const dot = document.querySelector('.badge-dot');
    const text = document.getElementById('dataModeText');
    if (d.dataMode === 'real') {
      dot.className = 'badge-dot real';
      text.textContent = 'Live Data';
    } else {
      dot.className = 'badge-dot mock';
      text.textContent = 'Mock Data';
    }
  } catch (_) {}
}

// ─── NAVIGATION ──────────────────────────────────────────────────────────────
function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const section = document.getElementById(`section-${name}`);
  const nav = document.getElementById(`nav-${name}`);
  if (section) section.classList.add('active');
  if (nav) nav.classList.add('active');
  document.getElementById('pageTitle').textContent = nav?.querySelector('span:last-child')?.textContent
    + ' — Cloud Cost Optimizer';
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
async function doLogin() {
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;
  const selectedClouds = ['aws', 'azure', 'gcp'].filter(c => document.getElementById(`chk-${c}`)?.checked);

  setLoading('loginResult', 'Logging in...');
  const r = await apiCall('POST', '/auth/login', { username, password, selectedClouds });
  r._path = '/auth/login';

  if (r.ok && r.data.token) {
    authToken = r.data.token;
    localStorage.setItem('cloudopt_token', authToken);
    updateTokenUI();
  }

  showResult('loginResult', r);
}

async function doRegister() {
  setLoading('loginResult', 'Registering...');
  const r = await apiCall('POST', '/auth/register', {
    username: 'demouser',
    email: 'demo@test.com',
    password: 'pass123',
    name: 'Demo User',
  });
  r._path = '/auth/register';
  showResult('loginResult', r);
}

async function addCloudAccount() {
  const cloud = document.getElementById('addCloudSelect').value;
  setLoading('addCloudResult', 'Adding cloud account...');
  const r = await apiCall('POST', '/auth/cloud-account', { cloud, credentials: {} });
  r._path = '/auth/cloud-account';
  showResult('addCloudResult', r);
}

// ─── HEALTH ───────────────────────────────────────────────────────────────────
async function checkHealth() {
  setLoading('healthResult', 'Checking health...');
  const r = await apiCall('GET', '/health');
  r._path = '/health';
  showResult('healthResult', r);
  updateDataModeBadge();
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
async function getDashboard() {
  const cloud = document.getElementById('dashCloud').value;
  setLoading('dashResult', `Fetching ${cloud.toUpperCase()} dashboard...`);
  const r = await apiCall('GET', `/dashboard/${cloud}`);
  r._path = `/dashboard/${cloud}`;
  showResult('dashResult', r);
}

async function getAlerts() {
  const cloud = document.getElementById('dashCloud').value;
  setLoading('dashResult', 'Fetching alerts...');
  const r = await apiCall('GET', `/dashboard/${cloud}/alerts`);
  r._path = `/dashboard/${cloud}/alerts`;
  showResult('dashResult', r);
}

async function getDataStatus() {
  setLoading('dashResult', 'Fetching data source status...');
  const r = await apiCall('GET', '/dashboard/status');
  r._path = '/dashboard/status';
  showResult('dashResult', r);
}

async function refreshCache() {
  const cloud = document.getElementById('dashCloud').value;
  setLoading('dashResult', 'Refreshing cache...');
  const r = await apiCall('POST', `/dashboard/${cloud}/refresh`);
  r._path = `/dashboard/${cloud}/refresh`;
  showResult('dashResult', r);
}

// ─── SERVICES ────────────────────────────────────────────────────────────────
const serviceOptions = {
  aws: ['ec2','lambda','s3','rds','dynamodb','cloudfront','ecs','elasticbeanstalk'],
  azure: ['virtual_machines','app_service','functions','aks','blob_storage','sql_database','cosmos_db','file_storage'],
  gcp: ['compute_engine','gke','cloud_storage','firestore','bigquery','cloud_functions','app_engine','filestore'],
};

function updateServiceOptions() {
  const cloud = document.getElementById('svcCloud').value;
  const sel = document.getElementById('svcKey');
  sel.innerHTML = serviceOptions[cloud].map(s => `<option value="${s}">${s}</option>`).join('');
}

async function getAllServices() {
  const cloud = document.getElementById('svcCloud').value;
  setLoading('svcResult', 'Fetching all services...');
  const r = await apiCall('GET', `/dashboard/${cloud}/services`);
  r._path = `/dashboard/${cloud}/services`;
  showResult('svcResult', r);
}

async function getServiceDetail() {
  const cloud = document.getElementById('svcCloud').value;
  const svc = document.getElementById('svcKey').value;
  setLoading('svcResult', `Fetching ${svc} details...`);
  const r = await apiCall('GET', `/dashboard/${cloud}/service/${svc}`);
  r._path = `/dashboard/${cloud}/service/${svc}`;
  showResult('svcResult', r);
}

// ─── INSTANCE DETAIL ─────────────────────────────────────────────────────────
async function getInstanceDetail() {
  const cloud = document.getElementById('instCloud').value;
  const svc = document.getElementById('instService').value;
  const id = encodeURIComponent(document.getElementById('instId').value);
  setLoading('instResult', 'Fetching instance...');
  const r = await apiCall('GET', `/dashboard/${cloud}/service/${svc}/instance/${id}`);
  r._path = `/dashboard/${cloud}/service/${svc}/instance/${id}`;
  showResult('instResult', r);
}

// ─── AI ───────────────────────────────────────────────────────────────────────
async function getAIOverview() {
  const cloud = document.getElementById('aiCloud').value;
  setLoading('aiOverviewResult', '🤖 Generating AI overview (may take a moment)...');
  const r = await apiCall('GET', `/ai/overview/${cloud}`);
  r._path = `/ai/overview/${cloud}`;
  showResult('aiOverviewResult', r, true);
}

async function getInstanceAI() {
  const cloud = document.getElementById('aiInstCloud').value;
  const svc = document.getElementById('aiInstService').value;
  const id = encodeURIComponent(document.getElementById('aiInstId').value);
  setLoading('aiInstResult', '🤖 Analyzing instance...');
  const r = await apiCall('GET', `/ai/instance/${cloud}/${svc}/${id}`);
  r._path = `/ai/instance/${cloud}/${svc}/${id}`;
  showResult('aiInstResult', r, true);
}

// ─── CHAT ─────────────────────────────────────────────────────────────────────
function addChatMessage(boxId, role, text) {
  const box = document.getElementById(boxId);
  const msg = document.createElement('div');
  msg.className = `chat-message ${role}`;
  msg.textContent = text;
  box.appendChild(msg);
  box.scrollTop = box.scrollHeight;
  return msg;
}

async function sendChat() {
  const input = document.getElementById('chatInput');
  const message = input.value.trim();
  if (!message) return;

  const cloud = document.getElementById('chatCloud').value;
  addChatMessage('chatBox', 'user', message);
  input.value = '';

  const loadingMsg = addChatMessage('chatBox', 'loading', '🤖 Thinking...');

  try {
    const r = await apiCall('POST', '/ai/chat', { message, cloud: cloud || undefined });
    loadingMsg.remove();
    if (r.ok) {
      addChatMessage('chatBox', 'ai', r.data.message);
    } else {
      addChatMessage('chatBox', 'system', `Error: ${r.data.message}`);
    }
  } catch (err) {
    loadingMsg.remove();
    addChatMessage('chatBox', 'system', `Network error: ${err.message}`);
  }
}

async function clearChat() {
  const cloud = document.getElementById('chatCloud').value;
  await apiCall('POST', '/ai/chat/clear', { cloud: cloud || undefined, context: 'dashboard' });
  const box = document.getElementById('chatBox');
  box.innerHTML = '<div class="chat-message system"><span>💬 Chat history cleared</span></div>';
}

// ─── MIGRATION ────────────────────────────────────────────────────────────────
async function getMigrationAdvice() {
  const cur = document.getElementById('migCurrentCloud').value;
  const tgt = document.getElementById('migTargetCloud').value;
  const query = tgt ? `?targetCloud=${tgt}` : '';
  setLoading('migResult', '🚀 Generating migration analysis...');
  const r = await apiCall('GET', `/ai/migration/${cur}${query}`);
  r._path = `/ai/migration/${cur}${query}`;
  showResult('migResult', r, true);
}

async function sendMigrationChat() {
  const input = document.getElementById('migChatInput');
  const message = input.value.trim();
  if (!message) return;
  const cloud = document.getElementById('migCurrentCloud').value;
  input.value = '';

  setLoading('migChatResult', '🤖 Thinking about migration...');
  const r = await apiCall('POST', '/ai/chat', { message, cloud, context: 'migration' });
  r._path = '/ai/chat';

  const el = document.getElementById('migChatResult');
  el.classList.add('visible');
  el.innerHTML = `
    <div class="result-header"><span>🤖 AI Migration Response</span></div>
    <div style="padding:14px"><div class="ai-output">${escapeHtml(r.data.message || r.data.error || JSON.stringify(r.data))}</div></div>
  `;
}

// ─── MULTI-CLOUD ─────────────────────────────────────────────────────────────
async function getMultiCloud() {
  const clouds = ['aws','azure','gcp'].filter(c => document.getElementById(`mc-${c}`)?.checked).join(',');
  setLoading('multicloudResult', 'Fetching multi-cloud summary...');
  const r = await apiCall('GET', `/dashboard/multi-cloud?clouds=${clouds}`);
  r._path = `/dashboard/multi-cloud?clouds=${clouds}`;
  showResult('multicloudResult', r);
}

async function getBestCloud() {
  const clouds = ['aws','azure','gcp'].filter(c => document.getElementById(`mc-${c}`)?.checked).join(',');
  setLoading('multicloudResult', '🤖 Analyzing best cloud...');
  const r = await apiCall('GET', `/ai/best-cloud?clouds=${clouds}`);
  r._path = `/ai/best-cloud?clouds=${clouds}`;
  showResult('multicloudResult', r, true);
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
updateTokenUI();
updateDataModeBadge();
showSection('login');

// If already logged in, show health first
if (authToken) showSection('health');
