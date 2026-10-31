const API = 'https://api.mail.tm';
let accountToken = null;
let currentPassword = null;

const emailInput = document.getElementById('email');
const messagesDiv = document.getElementById('messages');
const statusText = document.getElementById('statusText');
const domainSelect = document.getElementById('domainSelect');
const newMailBtn = document.getElementById('newMailBtn');
const copyBtn = document.getElementById('copyBtn');

// Hàm tạo chuỗi ngẫu nhiên
function randomString(len) {
  return Math.random().toString(36).substring(2, 2 + len);
}

// 1. Tải danh sách Domain có sẵn của Mail.tm
async function loadDomains() {
  try {
    const res = await fetch(`${API}/domains?page=1`);
    const data = await res.json();
    domainSelect.innerHTML = '';
    data['hydra:member'].forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.domain;
      opt.textContent = '@' + d.domain;
      domainSelect.appendChild(opt);
    });
  } catch (e) {
    console.error("Lỗi tải domain");
  }
}

// 2. Tạo tài khoản email mới
async function createAccount(domain) {
  statusText.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tạo email...';
  messagesDiv.innerHTML = '';
  emailInput.value = '';
  
  const address = `${randomString(10)}@${domain}`;
  currentPassword = randomString(12);

  try {
    // Tạo account
    const res = await fetch(`${API}/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, password: currentPassword })
    });
    if (!res.ok) throw new Error("Tạo thất bại");
    
    const data = await res.json();
    emailInput.value = data.address;

    // Lấy token đăng nhập
    const tokenRes = await fetch(`${API}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, password: currentPassword })
    });
    const tokenData = await tokenRes.json();
    accountToken = tokenData.token;
    
    statusText.innerHTML = '<i class="fa-solid fa-circle-check" style="color:#10b981"></i> Sẵn sàng nhận thư! Tự động cập nhật mỗi 5s.';
    loadMessages();
    
    // Tự động load lại sau mỗi 5 giây
    if(window.refreshInterval) clearInterval(window.refreshInterval);
    window.refreshInterval = setInterval(loadMessages, 5000);

  } catch (err) {
    statusText.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:#ef4444"></i> Lỗi kết nối. Hãy bấm "Tạo Email Mới".';
  }
}

// 3. Tải danh sách thư
async function loadMessages() {
  if (!accountToken) return;
  
  try {
    const res = await fetch(`${API}/messages`, {
      headers: { Authorization: `Bearer ${accountToken}` }
    });
    const data = await res.json();
    const list = data['hydra:member'] || [];

    if (list.length === 0) {
      messagesDiv.innerHTML = '<p class="empty-msg">Hộp thư đang trống. Hãy gửi thử một email đến địa chỉ trên!</p>';
      return;
    }

    messagesDiv.innerHTML = '';
    list.forEach(msg => {
      const div = document.createElement('div');
      div.className = 'message';
      const date = new Date(msg.createdAt).toLocaleTimeString('vi-VN');
      
      div.innerHTML = `
        <div class="subject">${msg.subject || '(Không có tiêu đề)'}</div>
        <div class="from"><span>Từ: ${msg.from.address}</span> <span>${date}</span></div>
        <div class="snippet">${msg.intro || '...'}</div>
      `;
      
      // Bấm vào để xem chi tiết (mở tab mới an toàn)
      div.addEventListener('click', () => viewMessage(msg.id));
      messagesDiv.appendChild(div);
    });
  } catch (e) {
    console.log("Đang chờ thư...");
  }
}

// 4. Xem chi tiết thư (mở tab mới)
async function viewMessage(id) {
  try {
    const res = await fetch(`${API}/messages/${id}`, {
      headers: { Authorization: `Bearer ${accountToken}` }
    });
    const msg = await res.json();
    
    // Tạo một cửa sổ mới để hiển thị nội dung an toàn
    const win = window.open('', '_blank');
    win.document.write(`
      <html>
        <head><title>${msg.subject}</title></head>
        <body style="font-family: sans-serif; padding: 20px;">
          <h2>${msg.subject}</h2>
          <p><b>Từ:</b> ${msg.from.address}</p>
          <hr>
          <div>${msg.html ? msg.html.join('') : (msg.text || 'Không có nội dung')}</div>
        </body>
      </html>
    `);
    win.document.close();
  } catch (e) {
    alert("Không thể tải nội dung thư!");
  }
}

// --- CÁC SỰ KIỆN BẤM NÚT ---

// Copy email
copyBtn.addEventListener('click', () => {
  if(!emailInput.value) return;
  navigator.clipboard.writeText(emailInput.value);
  copyBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
  setTimeout(() => copyBtn.innerHTML = '<i class="fa-solid fa-copy"></i>', 1500);
});

// Tạo email mới (ngẫu nhiên)
newMailBtn.addEventListener('click', () => {
  const domain = domainSelect.value;
  if(domain) createAccount(domain);
});

// Khi thay đổi domain trong ô select -> Tạo luôn email mới theo domain đó
domainSelect.addEventListener('change', () => {
  const domain = domainSelect.value;
  if(domain) createAccount(domain);
});

// --- KHỞI CHẠY ---
async function init() {
  await loadDomains();
  const defaultDomain = domainSelect.value;
  if (defaultDomain) {
    createAccount(defaultDomain);
  }
}
init();
