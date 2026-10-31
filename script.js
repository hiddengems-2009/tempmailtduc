const API = 'https://api.mail.tm';
let accountToken = null;
const emailInput = document.getElementById('email');
const messagesDiv = document.getElementById('messages');

function randomString(len) {
  return Math.random().toString(36).substring(2, 2 + len);
}

async function createAccount() {
  const domainsRes = await fetch(`${API}/domains?page=1`);
  const domains = await domainsRes.json();
  const domain = domains['hydra:member'][0].domain;
  const address = `${randomString(10)}@${domain}`;
  const password = randomString(12);

  const res = await fetch(`${API}/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, password })
  });
  const data = await res.json();
  emailInput.value = data.address;

  const tokenRes = await fetch(`${API}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, password })
  });
  const tokenData = await tokenRes.json();
  accountToken = tokenData.token;
  loadMessages();
}

async function loadMessages() {
  if (!accountToken) return;
  messagesDiv.innerHTML = '<p class="loading">Đang tải...</p>';
  const res = await fetch(`${API}/messages`, {
    headers: { Authorization: `Bearer ${accountToken}` }
  });
  const data = await res.json();
  const list = data['hydra:member'] || [];

  if (list.length === 0) {
    messagesDiv.innerHTML = '<p class="loading">Chưa có email nào. Hãy gửi thử!</p>';
    return;
  }

  messagesDiv.innerHTML = '';
  list.forEach(msg => {
    const div = document.createElement('div');
    div.className = 'message';
    div.innerHTML = `<div class="subject">${msg.subject || '(Không tiêu đề)'}</div>
                     <div class="from">Từ: ${msg.from.address}</div>
                     <div class="snippet">${msg.intro || ''}</div>`;
    div.addEventListener('click', () => {
        window.open(`https://mail.tm/en/messages/${msg.id}`, '_blank');
    });
    messagesDiv.appendChild(div);
  });
}

document.getElementById('copyBtn').addEventListener('click', () => {
  navigator.clipboard.writeText(emailInput.value);
  alert('Đã copy email!');
});

document.getElementById('refreshBtn').addEventListener('click', loadMessages);

createAccount().catch(err => {
  messagesDiv.innerHTML = `<p class="loading">Lỗi kết nối, hãy tải lại trang.</p>`;
});
