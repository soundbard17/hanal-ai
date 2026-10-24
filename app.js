const sidebar = document.getElementById('sidebar');
const chatWrapper = document.getElementById('chatWrapper');
const heroSection = document.getElementById('heroSection');
const userInput = document.getElementById('userInput');
const chatContainer = document.getElementById('chatContainer');
const sendBtn = document.getElementById('sendBtn');
const userEmailDisplay = document.getElementById('userEmailDisplay');
const userStatus = document.getElementById('userStatus');
const avatarInitial = document.getElementById('avatarInitial');
const authBtn = document.getElementById('authBtn');
const actionDropdown = document.getElementById('actionDropdown');
const fileUploadInput = document.getElementById('fileUploadInput');

let chatHistory = [];
let currentUser = localStorage.getItem('hanal_user_email') || null;

function initUser() {
  if (currentUser) {
    userEmailDisplay.innerText = currentUser;
    userStatus.innerText = 'Synced';
    avatarInitial.innerText = currentUser.charAt(0).toUpperCase();
    authBtn.innerText = 'Logout';
    loadUserSavedHistory();
  } else {
    userEmailDisplay.innerText = 'Guest User';
    userStatus.innerText = 'Local Mode';
    avatarInitial.innerText = 'G';
    authBtn.innerText = 'Login';
  }
}

function handleAuthAction() {
  if (currentUser) {
    if (confirm("Logout karna chahte hain?")) {
      localStorage.removeItem('hanal_user_email');
      currentUser = null;
      initUser();
      startNewChat();
    }
  } else {
    const email = prompt("Apna email enter karein chat history sync karne ke liye:");
    if (email && email.includes('@')) {
      localStorage.setItem('hanal_user_email', email.trim().toLowerCase());
      currentUser = email.trim().toLowerCase();
      initUser();
    } else if (email) {
      alert("Kripya valid email address enter karein.");
    }
  }
}

function saveChatToStorage() {
  if (currentUser && chatHistory.length > 0) {
    localStorage.setItem(`hanal_history_${currentUser}`, JSON.stringify(chatHistory));
  }
}

function loadUserSavedHistory() {
  if (!currentUser) return;
  const saved = localStorage.getItem(`hanal_history_${currentUser}`);
  if (saved) {
    try {
      chatHistory = JSON.parse(saved);
      chatWrapper.innerHTML = '';
      if (heroSection) heroSection.style.display = 'none';

      chatHistory.forEach(item => {
        const sender = item.role === 'user' ? 'user' : 'assistant';
        const text = item.parts[0]?.text || '';
        const bubble = appendMessage(sender, '');
        if (sender === 'assistant') {
          bubble.innerHTML = marked.parse(text);
        } else {
          bubble.innerText = text;
        }
      });
    } catch (e) {
      console.error(e);
    }
  }
}

function toggleSidebar() {
  sidebar.classList.toggle('collapsed');
}

/* Action Menu Toggle & Events */
function toggleActionMenu(e) {
  e.stopPropagation();
  actionDropdown.classList.toggle('show');
}

// Close menu on outside click
document.addEventListener('click', (e) => {
  if (actionDropdown && !actionDropdown.contains(e.target) && e.target.id !== 'actionBtn') {
    actionDropdown.classList.remove('show');
  }
});

function triggerFileUpload() {
  actionDropdown.classList.remove('show');
  fileUploadInput.click();
}

function handleFileSelected(e) {
  const files = e.target.files;
  if (files && files.length > 0) {
    const fileNames = Array.from(files).map(f => f.name).join(', ');
    userInput.value = `[Uploaded File: ${fileNames}] `;
    userInput.focus();
  }
}

function selectActionOption(actionType) {
  actionDropdown.classList.remove('show');
  if (actionType === 'Create Image') {
    userInput.value = 'Generate an image of: ';
  } else if (actionType === 'Create Video') {
    userInput.value = 'Create a video concept for: ';
  }
  userInput.focus();
  userInput.style.height = 'auto';
  userInput.style.height = (userInput.scrollHeight) + 'px';
}

userInput.addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = (this.scrollHeight) + 'px';
});

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function startNewChat() {
  chatHistory = [];
  if (currentUser) {
    localStorage.removeItem(`hanal_history_${currentUser}`);
  }
  chatWrapper.innerHTML = '';
  chatWrapper.appendChild(heroSection);
  heroSection.style.display = 'flex';
  userInput.value = '';
  userInput.style.height = 'auto';
  userInput.focus();
}

async function sendMessage() {
  const text = userInput.value.trim();
  if (!text) return;

  if (heroSection) heroSection.style.display = 'none';

  appendMessage('user', text);
  chatHistory.push({
    role: 'user',
    parts: [{ text: text }]
  });

  saveChatToStorage();

  userInput.value = '';
  userInput.style.height = 'auto';
  userInput.disabled = true;
  sendBtn.disabled = true;

  const aiBubble = appendMessage('assistant', '');
  const waveLoader = document.createElement('div');
  waveLoader.className = 'typing-wave-loader';
  waveLoader.innerHTML = '<span></span><span></span><span></span>';
  aiBubble.appendChild(waveLoader);

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history: chatHistory })
    });

    if (!response.ok) {
      waveLoader.remove();
      const errData = await response.json();
      aiBubble.innerText = errData.error || 'Server error occurred.';
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');

    let streamDone = false;
    let targetText = '';
    let renderedLength = 0;
    let loaderRemoved = false;

    const cursor = document.createElement('span');
    cursor.className = 'cursor-blink';

    const typingInterval = new Promise((resolve) => {
      const interval = setInterval(() => {
        if (targetText.length > 0 && !loaderRemoved) {
          waveLoader.remove();
          loaderRemoved = true;
        }

        if (renderedLength < targetText.length) {
          const remaining = targetText.length - renderedLength;
          const step = remaining > 40 ? 3 : remaining > 15 ? 2 : 1;

          renderedLength = Math.min(renderedLength + step, targetText.length);
          const currentSlice = targetText.slice(0, renderedLength);

          aiBubble.innerHTML = marked.parse(currentSlice);
          aiBubble.appendChild(cursor);
          chatContainer.scrollTop = chatContainer.scrollHeight;
        } else if (streamDone) {
          clearInterval(interval);
          resolve();
        }
      }, 16);
    });

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        streamDone = true;
        break;
      }
      const chunk = decoder.decode(value, { stream: true });
      targetText += chunk;
    }

    await typingInterval;
    cursor.remove();

    chatHistory.push({
      role: 'model',
      parts: [{ text: targetText }]
    });

    saveChatToStorage();

  } catch (err) {
    waveLoader.remove();
    aiBubble.innerText = 'Network error. Please try again.';
  } finally {
    userInput.disabled = false;
    sendBtn.disabled = false;
    userInput.focus();
  }
}

function appendMessage(sender, text) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${sender}`;

  if (sender === 'assistant') {
    msgDiv.innerHTML = `
      <div class="avatar ai">
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9"/>
          <circle cx="12" cy="12" r="5.5"/>
          <circle cx="12" cy="12" r="2.2" fill="#0a0b0e"/>
        </svg>
      </div>
      <div class="bubble">${text}</div>
    `;
  } else {
    msgDiv.innerHTML = `
      <div class="bubble">${text}</div>
    `;
  }

  chatWrapper.appendChild(msgDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;

  return msgDiv.querySelector('.bubble');
}

initUser();
