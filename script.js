const html = document.documentElement;
const themeToggle = document.getElementById('themeToggle');
const siteLogo = document.getElementById('siteLogo');

function getTheme() { return localStorage.getItem('theme') || 'dark'; }

function applyTheme(theme) {
  html.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  siteLogo.src = theme === 'dark' ? 'public/dark.png' : 'public/light.png';
  siteLogo.alt = theme === 'dark' ? 'MS clicks Logo Dark' : 'MS clicks Logo Light';
}

function toggleTheme() {
  applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

themeToggle.addEventListener('click', toggleTheme);
applyTheme(getTheme());

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
  const btn = document.querySelector(`[data-tab="${tabName}"]`);
  const sec = document.getElementById(`tab-${tabName}`);
  if (btn) btn.classList.add('active');
  if (sec) sec.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
});

(function initBackground() {
  const canvas = document.getElementById('bgCanvas');
  const ctx = canvas.getContext('2d');
  let particles = [];
  let W, H;

  function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x = Math.random() * W;
      this.y = Math.random() * H;
      this.size = Math.random() * 1.8 + 0.4;
      this.speedX = (Math.random() - 0.5) * 0.4;
      this.speedY = (Math.random() - 0.5) * 0.4;
      this.opacity = Math.random() * 0.5 + 0.1;
      this.opacityDir = (Math.random() - 0.5) * 0.005;
      const colors = [
        'rgba(255,215,0,', 'rgba(255,200,50,',
        'rgba(200,160,255,', 'rgba(100,200,255,', 'rgba(255,255,255,'
      ];
      this.color = colors[Math.floor(Math.random() * colors.length)];
    }
    update() {
      this.x += this.speedX; this.y += this.speedY;
      this.opacity += this.opacityDir;
      if (this.opacity <= 0.05 || this.opacity >= 0.6) this.opacityDir *= -1;
      if (this.x < 0 || this.x > W || this.y < 0 || this.y > H) this.reset();
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = this.color + this.opacity + ')';
      ctx.fill();
    }
  }

  function initParticles() {
    const count = Math.min(Math.floor((W * H) / 8000), 150);
    particles = Array.from({ length: count }, () => new Particle());
  }

  function drawConnections() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 100) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(255,215,0,${(1 - dist/100)*0.12})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
  }

  function animate() {
    ctx.clearRect(0, 0, W, H);
    drawConnections();
    particles.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(animate);
  }

  window.addEventListener('resize', () => { resize(); initParticles(); });
  resize(); initParticles(); animate();
})();

function setupDropZone(dropZoneId, fileInputId, onFile) {
  const zone = document.getElementById(dropZoneId);
  const input = document.getElementById(fileInputId);
  const card = zone.closest('.upload-card') || zone;

  ['dragenter','dragover'].forEach(e => {
    zone.addEventListener(e, ev => { ev.preventDefault(); card.classList.add('drag-over'); });
  });
  ['dragleave','drop'].forEach(e => {
    zone.addEventListener(e, ev => { ev.preventDefault(); card.classList.remove('drag-over'); });
  });
  zone.addEventListener('drop', ev => {
    ev.preventDefault();
    if (ev.dataTransfer.files.length) onFile(ev.dataTransfer.files);
  });
  zone.addEventListener('click', ev => { if (ev.target.tagName !== 'BUTTON') input.click(); });
  input.addEventListener('change', () => { if (input.files.length) onFile(input.files); });
}