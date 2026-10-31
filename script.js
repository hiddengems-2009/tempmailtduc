// Sử dụng API của 1SecMail
const API = 'https://www.1secmail.com/api/v1/';

let currentEmail = null;
let currentLogin = null;
let currentDomain = null;

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

// 1. Lấy danh sách Domain từ 1SecMail
async function loadDomains() {
  try {
    const res = await fetch(`${API}?action=getDomainList`);
    if (!res.ok) throw new Error("Lỗi API");
    const domains = await res.json();
    
    domainSelect.innerHTML = '';
    domains.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = '@' + d;
      domainSelect.appendChild(opt);
    });
  } catch (e) {
    console.warn("Không tải được domain, dùng mặc định.");
    domainSelect.innerHTML = '<option value="1secmail.com">@1secmail.com</option>';
  }
}

// 2. Tạo tài khoản email mới
async function createAccount(domain) {
  statusText.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tạo email...';
  messagesDiv.innerHTML = '';
  
  // Tạo tên ngẫu nhiên
  currentLogin = randomString(10);
  currentDomain = domain;
  currentEmail = `${currentLogin}@${currentDomain}`;
  
  emailInput.value = currentEmail;
  statusText.innerHTML = '<i class="fa-solid fa-circle-check" style="color:#10b981"></i> Sẵn sàng nhận thư! Tự động cập nhật mỗi 5s.';
  
  loadMessages();
  
  // Tự động load lại sau mỗi 5 giây
  if(window.refreshInterval) clearInterval(window.refreshInterval);
  window.refreshInterval = setInterval(loadMessages, 5000);
}

// 3. Tải danh sách thư
async function loadMessages() {
  if (!currentLogin || !currentDomain) return;
  
  try {
    const res = await fetch(`${API}?action=getMessages&login=${currentLogin}&domain=${currentDomain}`);
    const list = await res.json();

    if (list.length === 0) {
  messagesDiv.innerHTML = `
    <div style="text-align: center; padding: 30px; color: #64748b; border: 2px dashed #cbd5e1; border-radius: 10px; margin-top: 20px;">
      <i class="fa-solid fa-envelope-open" style="font-size: 2rem; margin-bottom: 10px; color: #94a3b8;"></i>
      <p>Chưa có thư nào.</p>
      <p style="font-size: 0.85rem;">Hãy dùng một email khác gửi thử đến địa chỉ trên để kiểm tra!</p>
    </div>
  `;
  return;
    }

    messagesDiv.innerHTML = '';
    list.forEach(msg => {
      const div = document.createElement('div');
      div.className = 'message';
      // 1SecMail trả về thời gian dạng chuỗi, cắt bớt cho gọn
      const date = msg.date ? msg.date.substring(11, 16) : ''; 
      
      div.innerHTML = `
        <div class="subject">${msg.subject || '(Không có tiêu đề)'}</div>
        <div class="from"><span>Từ: ${msg.from}</span> <span>${date}</span></div>
      `;
      
      // Bấm vào để xem chi tiết
      div.addEventListener('click', () => viewMessage(msg.id));
      messagesDiv.appendChild(div);
    });
  } catch (e) {
    console.log("Đang chờ thư...", e);
  }
}

// 4. Xem chi tiết thư
async function viewMessage(id) {
  try {
    const res = await fetch(`${API}?action=readMessage&login=${currentLogin}&domain=${currentDomain}&id=${id}`);
    const msg = await res.json();
    
    // Tạo một cửa sổ mới để hiển thị nội dung an toàn
    const win = window.open('', '_blank');
    win.document.write(`
      <html>
        <head>
          <title>${msg.subject}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: sans-serif; padding: 20px; line-height: 1.6;">
          <h2>${msg.subject}</h2>
          <p><b>Từ:</b> ${msg.from}</p>
          <hr>
          <div>${msg.htmlBody || msg.textBody || 'Không có nội dung'}</div>
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

// Khi thay đổi domain trong ô select -> Tạo luôn email mới
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
