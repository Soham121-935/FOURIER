/* ========================================
   FOURIER GUIDE — AI Chatbot (NVIDIA NIM)
   ======================================== */

(function () {
  'use strict';

  const NVIDIA_API_URL = '/api/chat';
  const NVIDIA_MODEL = 'meta/llama-3.3-70b-instruct';

  const SYSTEM_PROMPT = `You are "Fourier AI", a friendly and knowledgeable tutor embedded inside a Fourier Domain Analysis study guide. You are an expert in:
- Trigonometric Fourier Series (TFS)
- Exponential Fourier Series (EFS)
- Fourier Transform (FT)
- Signal processing, symmetry properties, spectra analysis
- Math in general (calculus, complex numbers, linear algebra)

Rules:
1. When the user asks you to "read this page" or "explain what's on screen", use the PAGE CONTEXT provided to answer.
2. Give clear, step-by-step explanations suitable for engineering students.
3. Use LaTeX notation enclosed in $...$ for inline math and $$...$$ for display math.
4. Keep responses concise but thorough. Use bullet points and numbered steps.
5. If asked about something unrelated to math/engineering, you can still answer but mention you specialize in Fourier analysis.
6. Be encouraging and supportive — students are studying for exams!`;

  // ── State ──
  let isOpen = false;
  let isLoading = false;
  let chatHistory = [];
  let conversationMessages = []; // For multi-turn conversation (OpenAI messages format)

  // ── Extract Current Page Content ──
  function getCurrentPageContent() {
    const activeSection = document.querySelector('.question-section.active');
    if (!activeSection) return 'No active page content found.';

    // Clone and remove canvases/scripts for clean text extraction
    const clone = activeSection.cloneNode(true);
    clone.querySelectorAll('canvas, script, style, .vis-controls, .vis-slider').forEach(el => el.remove());

    // Get the text content, preserving some structure
    let text = '';

    // Page header
    const title = clone.querySelector('.page-title');
    const subtitle = clone.querySelector('.page-subtitle');
    const tag = clone.querySelector('.page-tag');
    if (tag) text += `[${tag.textContent.trim()}]\n`;
    if (title) text += `# ${title.textContent.trim()}\n`;
    if (subtitle) text += `${subtitle.textContent.trim()}\n\n`;

    // Cards & content
    clone.querySelectorAll('.card, .step-content, .final-answer, .symmetry-note').forEach(el => {
      const label = el.querySelector('.card-label, .step-title, .final-answer-label');
      if (label) text += `## ${label.textContent.trim()}\n`;
      // Get math blocks
      el.querySelectorAll('.math-block, .math-highlight, .result').forEach(math => {
        text += `${math.textContent.trim()}\n`;
      });
      // Get paragraph text
      el.querySelectorAll('p, li').forEach(p => {
        const t = p.textContent.trim();
        if (t) text += `${t}\n`;
      });
      text += '\n';
    });

    return text.trim() || 'No content could be extracted from the current page.';
  }

  // ── Chat with NVIDIA NIM API ──
  async function sendMessage(userMessage) {
    if (isLoading) return;
    isLoading = true;
    updateSendButton();

    // Detect if user wants page context
    const wantsContext = /read|page|screen|this|what('?s| is)|content|current|here|explain this|tell me about/i.test(userMessage);

    let fullUserMessage = userMessage;
    if (wantsContext) {
      const pageContent = getCurrentPageContent();
      fullUserMessage += `\n\n--- CURRENT PAGE CONTENT ---\n${pageContent}\n--- END PAGE CONTENT ---`;
    }

    // Add user message to UI
    addMessageToUI('user', userMessage);
    const loadingEl = addLoadingIndicator();

    // Build conversation in OpenAI messages format
    conversationMessages.push({
      role: 'user',
      content: fullUserMessage
    });

    try {
      const response = await fetch(NVIDIA_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: NVIDIA_MODEL,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...conversationMessages
          ],
          temperature: 0.7,
          top_p: 0.9,
          max_tokens: 2048,
          stream: true
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error?.message || errData?.detail || `API Error: ${response.status}`);
      }

      // Read stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let aiText = '';
      let buffer = '';
      
      loadingEl.remove();
      const messageDiv = addMessageToUI('ai', '');
      const bubbleEl = messageDiv.querySelector('.chat-bubble');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Keep the last line in the buffer because it might be incomplete!
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed === 'data: [DONE]') continue;
          if (trimmed.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(trimmed.slice(6));
              const delta = parsed.choices?.[0]?.delta?.content || '';
              if (delta) {
                aiText += delta;
                bubbleEl.innerHTML = renderMessageContent(aiText);
                scrollToBottom();
              }
            } catch (e) {
              // Ignore parse errors, though with proper buffering they should be rare
            }
          }
        }
      }

      if (!aiText) {
        aiText = "I couldn't generate a response. Please try again.";
        bubbleEl.innerHTML = renderMessageContent(aiText);
      } else {
        // Update history with the final text
        chatHistory[chatHistory.length - 1].text = aiText;
      }

      // Add AI response to conversation memory
      conversationMessages.push({
        role: 'assistant',
        content: aiText
      });

    } catch (err) {
      loadingEl.remove();
      addMessageToUI('ai', `⚠️ **Error:** ${err.message}\n\nPlease check your API key or internet connection.`);
      // Remove the failed user message from conversation so it doesn't break future requests
      conversationMessages.pop();
    }

    isLoading = false;
    updateSendButton();
    scrollToBottom();
  }

  // ── Render Markdown-ish + LaTeX ──
  function renderMessageContent(text) {
    // Escape HTML
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Display math blocks: $$...$$
    html = html.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
      return `<div class="chat-math-block">${renderKatex(math.trim(), true)}</div>`;
    });

    // Inline math: $...$
    html = html.replace(/\$([^\$\n]+?)\$/g, (_, math) => {
      return `<span class="chat-math-inline">${renderKatex(math.trim(), false)}</span>`;
    });

    // Bold: **text**
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Italic: *text*
    html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

    // Inline code: `text`
    html = html.replace(/`([^`]+)`/g, '<code class="chat-code">$1</code>');

    // Numbered lists
    html = html.replace(/^(\d+)\.\s+(.+)$/gm, '<li class="chat-ol-item">$2</li>');
    html = html.replace(/((?:<li class="chat-ol-item">.*<\/li>\n?)+)/g, '<ol class="chat-ol">$1</ol>');

    // Bullet lists
    html = html.replace(/^[-•]\s+(.+)$/gm, '<li class="chat-ul-item">$1</li>');
    html = html.replace(/((?:<li class="chat-ul-item">.*<\/li>\n?)+)/g, '<ul class="chat-ul">$1</ul>');

    // Headers
    html = html.replace(/^### (.+)$/gm, '<h4 class="chat-h4">$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3 class="chat-h3">$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h2 class="chat-h2">$1</h2>');

    // Line breaks (preserve double newlines as paragraph breaks)
    html = html.replace(/\n\n+/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');

    return `<p>${html}</p>`;
  }

  function renderKatex(math, displayMode) {
    if (window.katex) {
      try {
        return window.katex.renderToString(math, {
          displayMode,
          throwOnError: false,
          trust: true
        });
      } catch (e) {
        return `<span class="chat-math-error">${math}</span>`;
      }
    }
    return displayMode ? `<div>$$${math}$$</div>` : `$${math}$`;
  }

  // ── UI Helpers ──
  function addMessageToUI(role, text) {
    const messagesContainer = document.getElementById('chatbot-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message chat-message-${role}`;

    const avatar = document.createElement('div');
    avatar.className = `chat-avatar chat-avatar-${role}`;
    avatar.innerHTML = role === 'user' ? '<span>You</span>' : '<span>∑</span>';

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble chat-bubble-${role}`;

    if (role === 'ai') {
      bubble.innerHTML = renderMessageContent(text);
    } else {
      bubble.textContent = text;
    }

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(bubble);
    messagesContainer.appendChild(messageDiv);

    // Save to history
    chatHistory.push({ role, text });

    scrollToBottom();
    return messageDiv;
  }

  function addLoadingIndicator() {
    const messagesContainer = document.getElementById('chatbot-messages');
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'chat-message chat-message-ai';
    loadingDiv.innerHTML = `
      <div class="chat-avatar chat-avatar-ai"><span>∑</span></div>
      <div class="chat-bubble chat-bubble-ai chat-loading">
        <div class="chat-loading-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
    `;
    messagesContainer.appendChild(loadingDiv);
    scrollToBottom();
    return loadingDiv;
  }

  function scrollToBottom() {
    const messagesContainer = document.getElementById('chatbot-messages');
    if (messagesContainer) {
      requestAnimationFrame(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      });
    }
  }

  function updateSendButton() {
    const btn = document.getElementById('chatbot-send');
    if (btn) {
      btn.disabled = isLoading;
      btn.classList.toggle('loading', isLoading);
    }
  }

  // ── Build the Chatbot UI ──
  function buildChatbotUI() {
    // Floating Action Button
    const fab = document.createElement('button');
    fab.id = 'chatbot-fab';
    fab.className = 'chatbot-fab';
    fab.setAttribute('aria-label', 'Open AI Chat');
    fab.innerHTML = `
      <span class="chatbot-fab-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          <path d="M12 8v4"></path>
          <path d="M12 16h.01"></path>
        </svg>
      </span>
      <span class="chatbot-fab-text">Ask AI</span>
      <span class="chatbot-fab-pulse"></span>
    `;

    // Chat Panel
    const panel = document.createElement('div');
    panel.id = 'chatbot-panel';
    panel.className = 'chatbot-panel';
    panel.innerHTML = `
      <div class="chatbot-header">
        <div class="chatbot-header-info">
          <div class="chatbot-header-avatar">∑</div>
          <div>
            <div class="chatbot-header-title">Fourier AI</div>
            <div class="chatbot-header-subtitle">Ask anything · Reads page context</div>
          </div>
        </div>
        <div class="chatbot-header-actions">
          <button class="chatbot-clear-btn" id="chatbot-clear" title="Clear chat">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
          <button class="chatbot-close-btn" id="chatbot-close" title="Close chat">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
      <div class="chatbot-messages" id="chatbot-messages">
        <div class="chat-welcome">
          <div class="chat-welcome-icon">∑</div>
          <h3>Hey! I'm Fourier AI 👋</h3>
          <p>Ask me anything about Fourier Series, Transforms, or this study guide. I can also read the current page!</p>
          <div class="chat-suggestions">
            <button class="chat-suggestion" data-msg="Explain the current page to me">📖 Explain this page</button>
            <button class="chat-suggestion" data-msg="What is the difference between TFS and EFS?">🔄 TFS vs EFS</button>
            <button class="chat-suggestion" data-msg="How do I find the Fourier Transform of e^(-at)u(t)?">📐 FT of e⁻ᵃᵗu(t)</button>
            <button class="chat-suggestion" data-msg="Give me exam tips for Fourier analysis">📝 Exam tips</button>
          </div>
        </div>
      </div>
      <div class="chatbot-input-area">
        <div class="chatbot-input-wrapper">
          <textarea
            id="chatbot-input"
            class="chatbot-input"
            placeholder="Ask anything about Fourier analysis..."
            rows="1"
            autocomplete="off"
          ></textarea>
          <button id="chatbot-send" class="chatbot-send-btn" title="Send message">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
        <div class="chatbot-input-hint">Press Enter to send · Shift+Enter for new line</div>
      </div>
    `;

    document.body.appendChild(fab);
    document.body.appendChild(panel);

    // ── Event Listeners ──
    fab.addEventListener('click', toggleChat);

    document.getElementById('chatbot-close').addEventListener('click', () => {
      toggleChat(false);
    });

    document.getElementById('chatbot-clear').addEventListener('click', clearChat);

    const input = document.getElementById('chatbot-input');
    const sendBtn = document.getElementById('chatbot-send');

    sendBtn.addEventListener('click', () => {
      const msg = input.value.trim();
      if (msg && !isLoading) {
        input.value = '';
        autoResizeInput();
        sendMessage(msg);
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const msg = input.value.trim();
        if (msg && !isLoading) {
          input.value = '';
          autoResizeInput();
          sendMessage(msg);
        }
      }
    });

    input.addEventListener('input', autoResizeInput);

    // Suggestion buttons
    panel.querySelectorAll('.chat-suggestion').forEach(btn => {
      btn.addEventListener('click', () => {
        const msg = btn.dataset.msg;
        if (msg && !isLoading) {
          // Hide welcome screen
          const welcome = panel.querySelector('.chat-welcome');
          if (welcome) welcome.style.display = 'none';
          sendMessage(msg);
        }
      });
    });

    // Keyboard shortcut: Ctrl/Cmd + Shift + K to toggle chat
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'K') {
        e.preventDefault();
        toggleChat();
      }
      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        toggleChat(false);
      }
    });
  }

  function autoResizeInput() {
    const input = document.getElementById('chatbot-input');
    if (input) {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    }
  }

  function toggleChat(forceState) {
    isOpen = typeof forceState === 'boolean' ? forceState : !isOpen;

    const panel = document.getElementById('chatbot-panel');
    const fab = document.getElementById('chatbot-fab');

    if (isOpen) {
      panel.classList.add('open');
      fab.classList.add('hidden');
      // Focus input
      setTimeout(() => {
        document.getElementById('chatbot-input')?.focus();
      }, 350);
    } else {
      panel.classList.remove('open');
      fab.classList.remove('hidden');
    }
  }

  function clearChat() {
    const messagesContainer = document.getElementById('chatbot-messages');
    chatHistory = [];
    conversationParts = [];

    messagesContainer.innerHTML = `
      <div class="chat-welcome">
        <div class="chat-welcome-icon">∑</div>
        <h3>Hey! I'm Fourier AI 👋</h3>
        <p>Ask me anything about Fourier Series, Transforms, or this study guide. I can also read the current page!</p>
        <div class="chat-suggestions">
          <button class="chat-suggestion" data-msg="Explain the current page to me">📖 Explain this page</button>
          <button class="chat-suggestion" data-msg="What is the difference between TFS and EFS?">🔄 TFS vs EFS</button>
          <button class="chat-suggestion" data-msg="How do I find the Fourier Transform of e^(-at)u(t)?">📐 FT of e⁻ᵃᵗu(t)</button>
          <button class="chat-suggestion" data-msg="Give me exam tips for Fourier analysis">📝 Exam tips</button>
        </div>
      </div>
    `;

    // Re-bind suggestion buttons
    messagesContainer.querySelectorAll('.chat-suggestion').forEach(btn => {
      btn.addEventListener('click', () => {
        const msg = btn.dataset.msg;
        if (msg && !isLoading) {
          const welcome = messagesContainer.querySelector('.chat-welcome');
          if (welcome) welcome.style.display = 'none';
          sendMessage(msg);
        }
      });
    });
  }

  // ── Initialize ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildChatbotUI);
  } else {
    buildChatbotUI();
  }
})();
