// ================= CẤU HÌNH API =================
const PROVIDERS = {
  '1secmail': {
    name: '1SecMail',
    getDomains: async () => {
      const res = await fetch('https://www.1secmail.com/api/v1/?action=getDomainList');
      return await res.json();
    },
    createAccount: (domain) => {
      const login = Math.random().toString(36).substring(2, 12);
      return { login: login, domain: domain, email: `${login}@${domain}` };
    },
    getMessages: async (acc) => {
      const res = await fetch(`https://www.1secmail.com/api/v1/?action=getMessages&login=${acc.login}&domain=${acc.domain}`);
      return await res.json();
    },
    readMessage: async (acc, id) => {
      const res = await fetch(`https://www.1secmail.com/api/v1/?action=readMessage&login=${acc.login}&domain=${acc.domain}&id=${id}`);
      return await res.json();
    }
  },
  'guerrilla': {
    name: 'Guerrilla Mail',
    getDomains: async () => {
      // Guerrilla không có list domain rõ ràng, dùng mặc định của họ
      return ['guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'sharklasers.com', 'grr.la'];
    },
    createAccount: (domain) => {
      // Guerrilla dùng chung một session, ta chỉ cần lấy email mới
      const login = 'temp' + Math.random().toString(36).substring(2, 10);
      return { login: login, domain: domain, email: `${login}@${domain}` };
    },
    getMessages: async (acc) => {
      // Guerrilla API yêu cầu lấy mail trước để có session
      const res = await fetch(`https://api.guerrillamail.com/ajax.php?f=get_email_address&ip=127.0.0.1&agent=temp-mail`);
      const data = await res.json();
      // Sau đó lấy list mail (dùng email vừa tạo)
      const listRes = await fetch(`https://api.guerrillamail.com/ajax.php?f=get_email_list&offset=0`);
      const listData = await listRes.json();
      // Chuyển đổi format cho giống 1SecMail
      return listData.list.map(m => ({
        id: m.mail_id,
        from: m.mail_from,
        subject: m.mail_subject,
        date: new Date(m.mail_timestamp * 1000).toISOString()
      }));
    },
    readMessage: async (acc, id) => {
      const res = await fetch(`https://api.guerrillamail.com/ajax.php?f=fetch_email&email_id=${id}`);
      const data = await res.json();
      return {
        subject: data.mail_subject,
        from: data.mail_from,
        htmlBody: data.mail_body,
        textBody: data.mail_body
      };
    }
  },
  'mailgw': {
    name: 'Mail.gw',
    getDomains: async () => {
      const res = await fetch('https://api.mail.gw/domains');
      const data = await res.json();
      return data['hydra:member'].map(d => d.domain);
    },
    createAccount: async (domain) => {
      const login = Math.random().toString(36).substring(2, 12);
      const password = Math.random().toString(36).substring(2, 15);
      const email = `${login}@${domain}`;
      
      // Tạo account
      const res = await fetch('https://api.mail.gw/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: email, password: password })
      });
      if (!res.ok) throw new Error('Không thể tạo tài khoản Mail.gw');
      
      // Lấy token
      const tokenRes = await fetch('https://api.mail.gw/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: email, password: password })
      });
      const tokenData = await tokenRes.json();
      
      return { login: login, domain: domain, email: email, token: tokenData.token };
    },
    getMessages: async (acc) => {
      const res = await fetch('https://api.mail.gw/messages', {
        headers: { Authorization: `Bearer ${acc.token}` }
      });
      const data = await res.json();
      return data['hydra:member'].map(m => ({
        id: m.id,
        from: m.from.address,
        subject: m.subject,
        date: m.createdAt
      }));
    },
    readMessage: async (acc, id) => {
      const res = await fetch(`https://api.mail.gw/messages/${id}`, {
        headers: { Authorization: `Bearer ${acc.token}` }
      });
      const msg = await res.json();
      return {
        subject: msg.subject,
        from: msg.from.address,
        htmlBody: msg.html ? msg.html.join('') : null,
        textBody: msg.text
      };
    }
  }
};

// ================= BIẾN TOÀN CỤC =================
let currentProvider = '1secmail';
let currentAccount = null;
let refreshInterval = null;

// DOM Elements
const emailInput = document.getElementById('email');
const messagesDiv = document.getElementById('messages');
const statusText = document.getElementById('statusText');
const domainSelect = document.getElementById('domainSelect');
const newMailBtn = document.getElementById('newMailBtn');
const copyBtn = document.getElementById('copyBtn');

// Thêm ô chọn Provider vào giao diện (tự động chèn)
function injectProviderSelector() {
  const inboxHeader = document.querySelector('.inbox-header');
  if (inboxHeader && !document.getElementById('providerSelect')) {
    const div = document.createElement('div');
    div.style.marginBottom = '15px';
    div.innerHTML = `
      <label style="font-weight:600; font-size:0.9rem; color:#475569; margin-right:10px;">Nhà cung cấp:</label>
      <select id="providerSelect" style="padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1;">
        <option value="1secmail">1SecMail</option>
        <option value="guerrilla">Guerrilla Mail</option>
        <option value="mailgw">Mail.gw</option>
      </select>
    `;
    inboxHeader.parentNode.insertBefore(div, inboxHeader.nextSibling);
    
    document.getElementById('providerSelect').addEventListener('change', (e) => {
      currentProvider = e.target.value;
      initProvider();
    });
  }
}

// Hàm khởi tạo nhà cung cấp
async function initProvider() {
  statusText.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tải domain...';
  domainSelect.innerHTML = '<option value="">Đang tải...</option>';
  messagesDiv.innerHTML = '';
  emailInput.value = '';

  try {
    const domains = await PROVIDERS[currentProvider].getDomains();
    domainSelect.innerHTML = '';
    domains.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = '@' + d;
      domainSelect.appendChild(opt);
    });
    
    // Tự động tạo email đầu tiên
    if (domains.length > 0) {
      createNewEmail(domains[0]);
    }
  } catch (e) {
    statusText.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:#ef4444"></i> Lỗi tải domain. Hãy thử nhà cung cấp khác.';
  }
}

// Tạo email mới
async function createNewEmail(domain) {
  if (!domain) return;
  statusText.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tạo email...';
  messagesDiv.innerHTML = '';
  
  try {
    const acc = await PROVIDERS[currentProvider].createAccount(domain);
    currentAccount = acc;
    emailInput.value = acc.email;
    
    // Lưu vào localStorage
    localStorage.setItem('mail_provider', currentProvider);
    localStorage.setItem('mail_account', JSON.stringify(acc));
    localStorage.setItem('mail_expire', Date.now() + 10 * 60 * 1000); // 10 phút
    
    statusText.innerHTML = '<i class="fa-solid fa-circle-check" style="color:#10b981"></i> Sẵn sàng nhận thư!';
    
    // Bắt đầu tự động làm mới
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(loadMessages, 5000);
    loadMessages();
    
  } catch (e) {
    statusText.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:#ef4444"></i> Lỗi tạo email. Thử lại nhé.';
  }
}

// Tải thư
async function loadMessages() {
  if (!currentAccount) return;
  
  // Kiểm tra hết hạn 10 phút
  const expire = localStorage.getItem('mail_expire');
  if (expire && Date.now() > parseInt(expire)) {
    localStorage.clear();
    initProvider();
    return;
  }
  
  try {
    const list = await PROVIDERS[currentProvider].getMessages(currentAccount);
    
    if (!list || list.length === 0) {
      messagesDiv.innerHTML = `
        <div style="text-align: center; padding: 30px; color: #64748b; border: 2px dashed #cbd5e1; border-radius: 10px; margin-top: 20px;">
          <i class="fa-solid fa-envelope-open" style="font-size: 2rem; margin-bottom: 10px; color: #94a3b8;"></i>
          <p>Chưa có thư nào.</p>
          <p style="font-size: 0.85rem;">Hãy gửi thử một email đến địa chỉ trên!</p>
        </div>
      `;
      return;
    }
    
    messagesDiv.innerHTML = '';
    list.forEach(msg => {
      const div = document.createElement('div');
      div.className = 'message';
      const date = msg.date ? new Date(msg.date).toLocaleTimeString('vi-VN') : '';
      
      div.innerHTML = `
        <div class="subject">${msg.subject || '(Không có tiêu đề)'}</div>
        <div class="from"><span>Từ: ${msg.from}</span> <span>${date}</span></div>
      `;
      div.addEventListener('click', () => viewMessage(msg.id));
      messagesDiv.appendChild(div);
    });
  } catch (e) {
    console.log("Đang chờ thư...", e);
  }
}

// Xem chi tiết thư
async function viewMessage(id) {
  try {
    const msg = await PROVIDERS[currentProvider].readMessage(currentAccount, id);
    
    const win = window.open('', '_blank');
    win.document.write(`
      <html>
        <head><title>${msg.subject}</title><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
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

// ================= SỰ KIỆN =================
copyBtn.addEventListener('click', () => {
  if(!emailInput.value) return;
  navigator.clipboard.writeText(emailInput.value);
  copyBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
  setTimeout(() => copyBtn.innerHTML = '<i class="fa-solid fa-copy"></i>', 1500);
});

newMailBtn.addEventListener('click', () => {
  const domain = domainSelect.value;
  if(domain) createNewEmail(domain);
});

domainSelect.addEventListener('change', () => {
  const domain = domainSelect.value;
  if(domain) createNewEmail(domain);
});

// ================= KHỞI CHẠY =================
async function init() {
  injectProviderSelector();
  
  // Khôi phục trạng thái cũ nếu có
  const savedProvider = localStorage.getItem('mail_provider');
  const savedAccount = localStorage.getItem('mail_account');
  const savedExpire = localStorage.getItem('mail_expire');
  
  if (savedProvider && savedAccount && savedExpire && Date.now() < parseInt(savedExpire)) {
    currentProvider = savedProvider;
    currentAccount = JSON.parse(savedAccount);
    document.getElementById('providerSelect').value = currentProvider;
    
    // Tải lại domain cho provider cũ (để hiển thị đúng select box)
    const domains = await PROVIDERS[currentProvider].getDomains();
    domainSelect.innerHTML = '';
    domains.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = '@' + d;
      domainSelect.appendChild(opt);
    });
    domainSelect.value = currentAccount.domain;
    emailInput.value = currentAccount.email;
    
        statusText.innerHTML = '<i class="fa-solid fa-circle-check" style="color:#10b981"></i> Đã khôi phục phiên trước!';
    
    // Tải thư ngay lập tức khi vừa F5
    await loadMessages(); 
    
    // Sau đó mới bật tự động làm mới mỗi 5s
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(loadMessages, 5000);
  } else {
    // Nếu không có gì, khởi tạo mặc định
    localStorage.clear();
    initProvider();
  }
}

// Đảm bảo hàm init chạy ngay khi tải trang
init();
