/* ========================================
   FOURIER GUIDE — Interactivity
   ======================================== */

document.addEventListener('DOMContentLoaded', () => {
  // ── Navigation ──
  const navItems = document.querySelectorAll('.nav-item[data-q]');
  const sections = document.querySelectorAll('.question-section');
  const sidebar  = document.querySelector('.sidebar');
  const overlay  = document.querySelector('.sidebar-overlay');
  const menuBtn  = document.querySelector('.menu-toggle');

  function showQuestion(id) {
    // hide all
    sections.forEach(s => s.classList.remove('active'));
    navItems.forEach(n => n.classList.remove('active'));

    // show target
    const target = document.getElementById(id);
    if (target) {
      target.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'instant' });
      // re-render KaTeX in the newly visible section
      if (window.renderMathInElement) {
        renderMathInElement(target, katexOptions);
      }
      // Redraw active visualizers to fit dynamic containers
      if (window.triggerVisualizerRedraw) {
        window.triggerVisualizerRedraw(id);
      }
    }

    // highlight nav
    navItems.forEach(n => {
      if (n.dataset.q === id) n.classList.add('active');
    });

    // close mobile sidebar
    closeSidebar();
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      showQuestion(item.dataset.q);
    });
  });

  // Expose globally for summary-card clicks
  window.showQuestion = showQuestion;

  // ── Mobile Sidebar ──
  function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  if (menuBtn) menuBtn.addEventListener('click', openSidebar);
  if (overlay) overlay.addEventListener('click', closeSidebar);

  // ── Search ──
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.toLowerCase().trim();
      navItems.forEach(item => {
        const text = item.textContent.toLowerCase();
        const keywords = item.dataset.keywords ? item.dataset.keywords.toLowerCase() : '';
        const matches = !query || text.includes(query) || keywords.includes(query);
        item.classList.toggle('hidden', !matches);
      });
    });
  }

  // ── Scroll Progress ──
  const progressFill = document.querySelector('.progress-bar .fill');
  const scrollTopBtn = document.querySelector('.scroll-top-btn');

  window.addEventListener('scroll', () => {
    const scrolled = window.scrollY;
    const height = document.documentElement.scrollHeight - window.innerHeight;
    const pct = height > 0 ? (scrolled / height) * 100 : 0;
    if (progressFill) progressFill.style.width = pct + '%';
    if (scrollTopBtn) scrollTopBtn.classList.toggle('visible', scrolled > 300);
  });

  if (scrollTopBtn) {
    scrollTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ── KaTeX Config ──
  const katexOptions = {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '\\[', right: '\\]', display: true },
      { left: '\\(', right: '\\)', display: false },
      { left: '$', right: '$', display: false }
    ],
    throwOnError: false,
    trust: true,
  };

  // Initial render
  if (window.renderMathInElement) {
    renderMathInElement(document.body, katexOptions);
  }

  // ── Intersection Observer for step animations ──
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.step').forEach(step => {
    step.style.opacity = '0';
    step.style.transform = 'translateY(12px)';
    step.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    observer.observe(step);
  });

  // ── Keyboard Navigation ──
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;

    const currentNav = document.querySelector('.nav-item.active');
    const visibleNavs = [...navItems].filter(n => !n.classList.contains('hidden'));
    const idx = visibleNavs.indexOf(currentNav);

    if (e.key === 'ArrowDown' || e.key === 'j') {
      e.preventDefault();
      const next = visibleNavs[idx + 1];
      if (next) showQuestion(next.dataset.q);
    } else if (e.key === 'ArrowUp' || e.key === 'k') {
      e.preventDefault();
      const prev = visibleNavs[idx - 1];
      if (prev) showQuestion(prev.dataset.q);
    } else if (e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) {
      e.preventDefault();
      searchInput?.focus();
    }
  });

  // ── 📊 INTERACTIVE FOURIER VISUALIZERS ──
  function initVisualizers() {
    const style = getComputedStyle(document.documentElement);
    const colorAccent = style.getPropertyValue('--accent').trim() || '#3B82F6';
    const colorEmerald = style.getPropertyValue('--emerald').trim() || '#10B981';
    const colorViolet = style.getPropertyValue('--violet').trim() || '#8B5CF6';
    const colorMuted = style.getPropertyValue('--text-muted').trim() || '#64748B';
    const colorText = style.getPropertyValue('--text-1').trim() || '#F1F5F9';
    const colorBorder = style.getPropertyValue('--border').trim() || 'rgba(51, 65, 85, 0.5)';

    // Canvas scaling helper for crystal clear lines
    function scaleCanvas(canvas) {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      return { ctx, w: rect.width, h: rect.height };
    }

    // Grid drawing helper
    function drawGrid(ctx, w, h, xMin, xMax, yMin, yMax, xLabel, yLabel) {
      ctx.clearRect(0, 0, w, h);
      
      const toX = (x) => ((x - xMin) / (xMax - xMin)) * w;
      const toY = (y) => h - ((y - yMin) / (yMax - yMin)) * h;

      const cx0 = toX(0);
      const cy0 = toY(0);

      // Light grid lines
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.15)';
      ctx.lineWidth = 1;
      
      // X grid
      const xStep = (xMax - xMin) / 8;
      for (let x = Math.ceil(xMin / xStep) * xStep; x <= xMax; x += xStep) {
        if (Math.abs(x) < 1e-5) continue;
        const tx = toX(x);
        ctx.beginPath();
        ctx.moveTo(tx, 0);
        ctx.lineTo(tx, h);
        ctx.stroke();
      }

      // Y grid
      const yStep = (yMax - yMin) / 6;
      for (let y = Math.ceil(yMin / yStep) * yStep; y <= yMax; y += yStep) {
        if (Math.abs(y) < 1e-5) continue;
        const ty = toY(y);
        ctx.beginPath();
        ctx.moveTo(0, ty);
        ctx.lineTo(w, ty);
        ctx.stroke();
      }

      // Axes
      ctx.strokeStyle = colorBorder;
      ctx.lineWidth = 1.5;
      
      // X axis
      ctx.beginPath();
      ctx.moveTo(0, cy0);
      ctx.lineTo(w, cy0);
      ctx.stroke();

      // Y axis
      ctx.beginPath();
      ctx.moveTo(cx0, 0);
      ctx.lineTo(cx0, h);
      ctx.stroke();

      // Labels and ticks
      ctx.fillStyle = colorMuted;
      ctx.font = '10px JetBrains Mono';
      
      // Ticks X
      for (let x = Math.ceil(xMin / xStep) * xStep; x <= xMax; x += xStep) {
        if (Math.abs(x) < 1e-5) continue;
        ctx.fillText(x.toFixed(1), toX(x) - 10, cy0 + 14);
      }

      // Ticks Y
      for (let y = Math.ceil(yMin / yStep) * yStep; y <= yMax; y += yStep) {
        if (Math.abs(y) < 1e-5) continue;
        ctx.fillText(y.toFixed(1), cx0 + 6, toY(y) + 4);
      }

      // Axis names
      ctx.fillStyle = colorText;
      ctx.fillText(xLabel, w - 18, cy0 - 6);
      ctx.fillText(yLabel, cx0 + 6, 12);

      return { toX, toY, cx0, cy0 };
    }

    // 1. Q1: cos(t) lobes EFS
    const canvasQ1 = document.getElementById('canvas-q1');
    const sliderQ1N = document.getElementById('slider-q1-N');
    const valQ1N = document.getElementById('val-q1-N');

    function drawQ1() {
      if (!canvasQ1) return;
      const res = scaleCanvas(canvasQ1);
      if (!res) return;
      const { ctx, w, h } = res;
      const N = parseInt(sliderQ1N.value);
      valQ1N.textContent = N;

      const { toX, toY } = drawGrid(ctx, w, h, -Math.PI * 1.5, Math.PI * 1.5, -0.2, 1.2, 't', 'x(t)');

      // Draw original signal (dashed)
      ctx.strokeStyle = colorEmerald;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      for (let xPixel = 0; xPixel < w; xPixel++) {
        const t = -Math.PI * 1.5 + (xPixel / w) * Math.PI * 3;
        const yVal = Math.abs(Math.cos(t));
        if (xPixel === 0) ctx.moveTo(xPixel, toY(yVal));
        else ctx.lineTo(xPixel, toY(yVal));
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Fourier Approximation
      ctx.strokeStyle = colorAccent;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let xPixel = 0; xPixel < w; xPixel++) {
        const t = -Math.PI * 1.5 + (xPixel / w) * Math.PI * 3;
        let yApprox = 2 / Math.PI;
        for (let k = 1; k <= N; k++) {
          const coef = (4 * Math.pow(-1, k)) / (Math.PI * (1 - 4 * k * k));
          yApprox += coef * Math.cos(2 * k * t);
        }
        if (xPixel === 0) ctx.moveTo(xPixel, toY(yApprox));
        else ctx.lineTo(xPixel, toY(yApprox));
      }
      ctx.stroke();
    }

    if (sliderQ1N) sliderQ1N.addEventListener('input', drawQ1);

    // 2. Q2: Full-wave rectified sine TFS
    const canvasQ2 = document.getElementById('canvas-q2');
    const sliderQ2N = document.getElementById('slider-q2-N');
    const sliderQ2A = document.getElementById('slider-q2-A');
    const valQ2N = document.getElementById('val-q2-N');
    const valQ2A = document.getElementById('val-q2-A');

    function drawQ2() {
      if (!canvasQ2) return;
      const res = scaleCanvas(canvasQ2);
      if (!res) return;
      const { ctx, w, h } = res;
      const N = parseInt(sliderQ2N.value);
      const A = parseFloat(sliderQ2A.value);
      valQ2N.textContent = N;
      valQ2A.textContent = A.toFixed(1);

      const { toX, toY } = drawGrid(ctx, w, h, -Math.PI * 1.5, Math.PI * 1.5, -0.2 * A, 1.2 * A, 't', 'x(t)');

      // Draw original
      ctx.strokeStyle = colorEmerald;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      for (let xPixel = 0; xPixel < w; xPixel++) {
        const t = -Math.PI * 1.5 + (xPixel / w) * Math.PI * 3;
        const yVal = A * Math.abs(Math.sin(t));
        if (xPixel === 0) ctx.moveTo(xPixel, toY(yVal));
        else ctx.lineTo(xPixel, toY(yVal));
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw TFS approximation
      ctx.strokeStyle = colorAccent;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let xPixel = 0; xPixel < w; xPixel++) {
        const t = -Math.PI * 1.5 + (xPixel / w) * Math.PI * 3;
        let yApprox = (2 * A) / Math.PI;
        for (let n = 1; n <= N; n++) {
          const coef = (-4 * A) / (Math.PI * (4 * n * n - 1));
          yApprox += coef * Math.cos(2 * n * t);
        }
        if (xPixel === 0) ctx.moveTo(xPixel, toY(yApprox));
        else ctx.lineTo(xPixel, toY(yApprox));
      }
      ctx.stroke();
    }

    if (sliderQ2N) sliderQ2N.addEventListener('input', drawQ2);
    if (sliderQ2A) sliderQ2A.addEventListener('input', drawQ2);

    // 3. Q3: Square Wave TFS
    const canvasQ3 = document.getElementById('canvas-q3');
    const sliderQ3N = document.getElementById('slider-q3-N');
    const valQ3N = document.getElementById('val-q3-N');
    const chkQ3 = document.getElementById('chk-q3-showHarmonics');

    function drawQ3() {
      if (!canvasQ3) return;
      const res = scaleCanvas(canvasQ3);
      if (!res) return;
      const { ctx, w, h } = res;
      const N = parseInt(sliderQ3N.value);
      valQ3N.textContent = N;
      const showComponents = chkQ3 ? chkQ3.checked : false;

      const { toX, toY } = drawGrid(ctx, w, h, -6, 6, -1.5, 1.5, 't', 'x(t)');

      // Draw original square wave
      ctx.strokeStyle = colorEmerald;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      for (let xPixel = 0; xPixel < w; xPixel++) {
        const t = -6 + (xPixel / w) * 12;
        const tMod = ((t % 4) + 4) % 4;
        const yVal = tMod < 2 ? 1 : -1;
        if (xPixel === 0) ctx.moveTo(xPixel, toY(yVal));
        else {
          const prevT = -6 + ((xPixel - 1) / w) * 12;
          const prevTMod = ((prevT % 4) + 4) % 4;
          const prevYVal = prevTMod < 2 ? 1 : -1;
          if (prevYVal !== yVal) {
            ctx.lineTo(xPixel, toY(prevYVal));
          }
          ctx.lineTo(xPixel, toY(yVal));
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw component sines if checked
      if (showComponents) {
        ctx.lineWidth = 1;
        for (let m = 1; m <= N; m++) {
          const n = 2 * m - 1;
          ctx.strokeStyle = `rgba(139, 92, 246, ${Math.max(0.15, 0.7 / m)})`;
          ctx.beginPath();
          for (let xPixel = 0; xPixel < w; xPixel++) {
            const t = -6 + (xPixel / w) * 12;
            const term = (4 / (Math.PI * n)) * Math.sin((n * Math.PI * t) / 2);
            if (xPixel === 0) ctx.moveTo(xPixel, toY(term));
            else ctx.lineTo(xPixel, toY(term));
          }
          ctx.stroke();
        }
      }

      // Draw Fourier Approximation
      ctx.strokeStyle = colorAccent;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let xPixel = 0; xPixel < w; xPixel++) {
        const t = -6 + (xPixel / w) * 12;
        let yApprox = 0;
        for (let m = 1; m <= N; m++) {
          const n = 2 * m - 1;
          yApprox += (4 / (Math.PI * n)) * Math.sin((n * Math.PI * t) / 2);
        }
        if (xPixel === 0) ctx.moveTo(xPixel, toY(yApprox));
        else ctx.lineTo(xPixel, toY(yApprox));
      }
      ctx.stroke();
    }

    if (sliderQ3N) sliderQ3N.addEventListener('input', drawQ3);
    if (chkQ3) chkQ3.addEventListener('change', drawQ3);

    // 4. Q4: One-Sided Exponential FT
    const canvasQ4T = document.getElementById('canvas-q4-time');
    const canvasQ4F = document.getElementById('canvas-q4-freq');
    const sliderQ4a = document.getElementById('slider-q4-a');
    const valQ4a = document.getElementById('val-q4-a');

    function drawQ4() {
      if (!sliderQ4a) return;
      const a = parseFloat(sliderQ4a.value);
      valQ4a.textContent = a.toFixed(1);

      // Time Domain
      if (canvasQ4T) {
        const res = scaleCanvas(canvasQ4T);
        if (res) {
          const { ctx, w, h } = res;
          const { toX, toY } = drawGrid(ctx, w, h, -1, 5, -0.2, 1.2, 't', 'x(t)');

          ctx.strokeStyle = colorAccent;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          for (let xPixel = 0; xPixel < w; xPixel++) {
            const t = -1 + (xPixel / w) * 6;
            const yVal = t >= 0 ? Math.exp(-a * t) : 0;
            if (xPixel === 0) ctx.moveTo(xPixel, toY(yVal));
            else {
              if (t >= 0 && -1 + ((xPixel - 1) / w) * 6 < 0) {
                ctx.lineTo(toX(0), toY(0));
                ctx.lineTo(toX(0), toY(1));
              }
              ctx.lineTo(xPixel, toY(yVal));
            }
          }
          ctx.stroke();
        }
      }

      // Frequency Domain
      if (canvasQ4F) {
        const res = scaleCanvas(canvasQ4F);
        if (res) {
          const { ctx, w, h } = res;
          const peak = 1 / a;
          const yMax = Math.max(1.5, peak * 1.15);
          const { toX, toY } = drawGrid(ctx, w, h, -10, 10, -0.1 * yMax, yMax, 'ω', '|X(ω)|');

          ctx.strokeStyle = colorViolet;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          for (let xPixel = 0; xPixel < w; xPixel++) {
            const omega = -10 + (xPixel / w) * 20;
            const yVal = 1 / Math.sqrt(a * a + omega * omega);
            if (xPixel === 0) ctx.moveTo(xPixel, toY(yVal));
            else ctx.lineTo(xPixel, toY(yVal));
          }
          ctx.stroke();
        }
      }
    }

    if (sliderQ4a) sliderQ4a.addEventListener('input', drawQ4);

    // 5. Q5: Double-Sided Exponential FT
    const canvasQ5T = document.getElementById('canvas-q5-time');
    const canvasQ5F = document.getElementById('canvas-q5-freq');
    const sliderQ5a = document.getElementById('slider-q5-a');
    const valQ5a = document.getElementById('val-q5-a');

    function drawQ5() {
      if (!sliderQ5a) return;
      const a = parseFloat(sliderQ5a.value);
      valQ5a.textContent = a.toFixed(1);

      // Time Domain
      if (canvasQ5T) {
        const res = scaleCanvas(canvasQ5T);
        if (res) {
          const { ctx, w, h } = res;
          const { toX, toY } = drawGrid(ctx, w, h, -4, 4, -0.2, 1.2, 't', 'x(t)');

          ctx.strokeStyle = colorAccent;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          for (let xPixel = 0; xPixel < w; xPixel++) {
            const t = -4 + (xPixel / w) * 8;
            const yVal = Math.exp(-a * Math.abs(t));
            if (xPixel === 0) ctx.moveTo(xPixel, toY(yVal));
            else ctx.lineTo(xPixel, toY(yVal));
          }
          ctx.stroke();
        }
      }

      // Frequency Domain
      if (canvasQ5F) {
        const res = scaleCanvas(canvasQ5F);
        if (res) {
          const { ctx, w, h } = res;
          const peak = 2 / a;
          const yMax = Math.max(2.5, peak * 1.15);
          const { toX, toY } = drawGrid(ctx, w, h, -10, 10, -0.1 * yMax, yMax, 'ω', '|X(ω)|');

          ctx.strokeStyle = colorViolet;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          for (let xPixel = 0; xPixel < w; xPixel++) {
            const omega = -10 + (xPixel / w) * 20;
            const yVal = (2 * a) / (a * a + omega * omega);
            if (xPixel === 0) ctx.moveTo(xPixel, toY(yVal));
            else ctx.lineTo(xPixel, toY(yVal));
          }
          ctx.stroke();
        }
      }
    }

    if (sliderQ5a) sliderQ5a.addEventListener('input', drawQ5);

    // 6. Q6: cos(Ω₀t) FT
    const canvasQ6T = document.getElementById('canvas-q6-time');
    const canvasQ6F = document.getElementById('canvas-q6-freq');
    const sliderQ6w = document.getElementById('slider-q6-w');
    const valQ6w = document.getElementById('val-q6-w');

    function drawQ6() {
      if (!sliderQ6w) return;
      const w0 = parseFloat(sliderQ6w.value);
      valQ6w.textContent = w0.toFixed(1);

      // Time Domain
      if (canvasQ6T) {
        const res = scaleCanvas(canvasQ6T);
        if (res) {
          const { ctx, w, h } = res;
          const { toX, toY } = drawGrid(ctx, w, h, -5, 5, -1.5, 1.5, 't', 'x(t)');

          ctx.strokeStyle = colorAccent;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          for (let xPixel = 0; xPixel < w; xPixel++) {
            const t = -5 + (xPixel / w) * 10;
            const yVal = Math.cos(w0 * t);
            if (xPixel === 0) ctx.moveTo(xPixel, toY(yVal));
            else ctx.lineTo(xPixel, toY(yVal));
          }
          ctx.stroke();
        }
      }

      // Frequency Domain (Delta Spikes)
      if (canvasQ6F) {
        const res = scaleCanvas(canvasQ6F);
        if (res) {
          const { ctx, w, h } = res;
          const { toX, toY } = drawGrid(ctx, w, h, -10, 10, -0.5, 4, 'ω', 'X(ω)');

          ctx.strokeStyle = colorViolet;
          ctx.fillStyle = colorViolet;
          ctx.lineWidth = 3;

          function drawArrow(xVal) {
            const cx = toX(xVal);
            const cyStart = toY(0);
            const cyEnd = toY(3.14159); // height is pi

            // Vertical line
            ctx.beginPath();
            ctx.moveTo(cx, cyStart);
            ctx.lineTo(cx, cyEnd);
            ctx.stroke();

            // Arrow head
            ctx.beginPath();
            ctx.moveTo(cx, cyEnd);
            ctx.lineTo(cx - 5, cyEnd + 8);
            ctx.lineTo(cx + 5, cyEnd + 8);
            ctx.closePath();
            ctx.fill();

            // Label
            ctx.fillStyle = colorText;
            ctx.textAlign = 'center';
            ctx.font = '10px JetBrains Mono';
            ctx.fillText('π·δ(ω' + (xVal > 0 ? '−' : '+') + w0.toFixed(1) + ')', cx, cyEnd - 12);
          }

          drawArrow(w0);
          drawArrow(-w0);
        }
      }
    }

    if (sliderQ6w) sliderQ6w.addEventListener('input', drawQ6);

    // 7. Q8: Gate Function FT
    const canvasQ8T = document.getElementById('canvas-q8-time');
    const canvasQ8F = document.getElementById('canvas-q8-freq');
    const sliderQ8tau = document.getElementById('slider-q8-tau');
    const valQ8tau = document.getElementById('val-q8-tau');

    function drawQ8() {
      if (!sliderQ8tau) return;
      const tau = parseFloat(sliderQ8tau.value);
      valQ8tau.textContent = tau.toFixed(1);

      // Time Domain
      if (canvasQ8T) {
        const res = scaleCanvas(canvasQ8T);
        if (res) {
          const { ctx, w, h } = res;
          const { toX, toY } = drawGrid(ctx, w, h, -3, 3, -0.2, 1.5, 't', 'x(t)');

          ctx.strokeStyle = colorAccent;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          for (let xPixel = 0; xPixel < w; xPixel++) {
            const t = -3 + (xPixel / w) * 6;
            const yVal = Math.abs(t) <= tau / 2 ? 1 : 0;
            if (xPixel === 0) ctx.moveTo(xPixel, toY(yVal));
            else {
              const prevT = -3 + ((xPixel - 1) / w) * 6;
              const prevVal = Math.abs(prevT) <= tau / 2 ? 1 : 0;
              if (prevVal !== yVal) {
                ctx.lineTo(xPixel, toY(prevVal));
              }
              ctx.lineTo(xPixel, toY(yVal));
            }
          }
          ctx.stroke();
        }
      }

      // Frequency Domain (Sinc)
      if (canvasQ8F) {
        const res = scaleCanvas(canvasQ8F);
        if (res) {
          const { ctx, w, h } = res;
          const yMax = Math.max(1.5, tau * 1.15);
          const yMin = -0.3 * tau;
          const { toX, toY } = drawGrid(ctx, w, h, -15, 15, yMin, yMax, 'ω', 'X(ω)');

          ctx.strokeStyle = colorViolet;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          for (let xPixel = 0; xPixel < w; xPixel++) {
            const omega = -15 + (xPixel / w) * 30;
            let yVal;
            if (Math.abs(omega) < 1e-5) {
              yVal = tau;
            } else {
              yVal = (2 * Math.sin((omega * tau) / 2)) / omega;
            }
            if (xPixel === 0) ctx.moveTo(xPixel, toY(yVal));
            else ctx.lineTo(xPixel, toY(yVal));
          }
          ctx.stroke();
        }
      }
    }

    if (sliderQ8tau) sliderQ8tau.addEventListener('input', drawQ8);

    // 8. Q9: Sawtooth Wave
    const canvasQ9 = document.getElementById('canvas-q9');
    const sliderQ9N = document.getElementById('slider-q9-N');
    const valQ9N = document.getElementById('val-q9-N');
    const chkQ9 = document.getElementById('chk-q9-showHarmonics');

    function drawQ9() {
      if (!canvasQ9) return;
      const res = scaleCanvas(canvasQ9);
      if (!res) return;
      const { ctx, w, h } = res;
      const N = parseInt(sliderQ9N.value);
      valQ9N.textContent = N;
      const showComponents = chkQ9 ? chkQ9.checked : false;

      const { toX, toY } = drawGrid(ctx, w, h, -3, 3, -1.5, 1.5, 't', 'x(t)');

      // Draw original sawtooth
      ctx.strokeStyle = colorEmerald;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      for (let xPixel = 0; xPixel < w; xPixel++) {
        const t = -3 + (xPixel / w) * 6;
        const tMod = ((t + 1) % 2 + 2) % 2 - 1;
        if (xPixel === 0) ctx.moveTo(xPixel, toY(tMod));
        else {
          const prevT = -3 + ((xPixel - 1) / w) * 6;
          const prevTMod = ((prevT + 1) % 2 + 2) % 2 - 1;
          if (prevTMod > tMod) {
            ctx.lineTo(xPixel, toY(prevTMod));
          }
          ctx.lineTo(xPixel, toY(tMod));
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw components
      if (showComponents) {
        ctx.lineWidth = 1;
        for (let k = 1; k <= N; k++) {
          ctx.strokeStyle = `rgba(139, 92, 246, ${Math.max(0.15, 0.7 / k)})`;
          ctx.beginPath();
          for (let xPixel = 0; xPixel < w; xPixel++) {
            const t = -3 + (xPixel / w) * 6;
            const term = (-2 * Math.pow(-1, k)) / (k * Math.PI) * Math.sin(k * Math.PI * t);
            if (xPixel === 0) ctx.moveTo(xPixel, toY(term));
            else ctx.lineTo(xPixel, toY(term));
          }
          ctx.stroke();
        }
      }

      // Draw Fourier Series approximation
      ctx.strokeStyle = colorAccent;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let xPixel = 0; xPixel < w; xPixel++) {
        const t = -3 + (xPixel / w) * 6;
        let yApprox = 0;
        for (let k = 1; k <= N; k++) {
          yApprox += (-2 * Math.pow(-1, k)) / (k * Math.PI) * Math.sin(k * Math.PI * t);
        }
        if (xPixel === 0) ctx.moveTo(xPixel, toY(yApprox));
        else ctx.lineTo(xPixel, toY(yApprox));
      }
      ctx.stroke();
    }

    if (sliderQ9N) sliderQ9N.addEventListener('input', drawQ9);
    if (chkQ9) chkQ9.addEventListener('change', drawQ9);

    // Global hook for tab/section switches
    window.triggerVisualizerRedraw = function(id) {
      if (id === 'q1') drawQ1();
      else if (id === 'q2') drawQ2();
      else if (id === 'q3') drawQ3();
      else if (id === 'q4') drawQ4();
      else if (id === 'q5') drawQ5();
      else if (id === 'q6') drawQ6();
      else if (id === 'q8') drawQ8();
      else if (id === 'q9') drawQ9();
      else if (id === 'q0') {
        setTimeout(() => {
          drawQ1();
          drawQ2();
          drawQ3();
          drawQ4();
          drawQ5();
          drawQ6();
          drawQ8();
          drawQ9();
        }, 50);
      }
    };

    // Initial draws
    setTimeout(() => {
      drawQ1();
      drawQ2();
      drawQ3();
      drawQ4();
      drawQ5();
      drawQ6();
      drawQ8();
      drawQ9();
    }, 100);
  }

  // Initialize all interactive visualizers
  initVisualizers();
});
