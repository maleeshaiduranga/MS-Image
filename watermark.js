let cvReady = false;
let wmOriginalImage = null;
let wmCanvas, wmMaskCanvas, wmResultCanvas;
let wmCtx, wmMaskCtx, wmResultCtx;
let isDrawing = false;
let drawMode = 'brush';
let brushSz = 30;
let undoStack = [];
let resultBlob = null;

function onOpenCvReady() {
  cvReady = true;
  const el = document.getElementById('cvLoading');
  if (el) el.style.display = 'none';
  console.log('OpenCV.js ready');
}

window.addEventListener('DOMContentLoaded', () => {
  wmCanvas       = document.getElementById('wmOrigCanvas');
  wmMaskCanvas   = document.getElementById('wmMaskCanvas');
  wmResultCanvas = document.getElementById('wmResultCanvas');
  if (!wmCanvas) return;

  wmCtx       = wmCanvas.getContext('2d');
  wmMaskCtx   = wmMaskCanvas.getContext('2d');
  wmResultCtx = wmResultCanvas.getContext('2d');

  setupDropZone('wmDropZone', 'wmFileInput', files => loadWmImage(files[0]));

  wmCanvas.addEventListener('mousedown',  startDraw);
  wmCanvas.addEventListener('mousemove',  drawMask);
  wmCanvas.addEventListener('mouseup',    stopDraw);
  wmCanvas.addEventListener('mouseleave', stopDraw);

  wmCanvas.addEventListener('touchstart', e => { e.preventDefault(); startDraw(touchEv(e)); }, { passive:false });
  wmCanvas.addEventListener('touchmove',  e => { e.preventDefault(); drawMask(touchEv(e));  }, { passive:false });
  wmCanvas.addEventListener('touchend',   stopDraw, { passive:false });

  document.getElementById('brushSize').addEventListener('input', e => {
    brushSz = parseInt(e.target.value);
    document.getElementById('brushSizeVal').textContent = brushSz;
  });
  document.getElementById('inpaintRadius').addEventListener('input', e => {
    document.getElementById('radiusVal').textContent = e.target.value;
  });
});

function touchEv(e) {
  const t = e.touches[0];
  const rect = wmCanvas.getBoundingClientRect();
  return { clientX: t.clientX, clientY: t.clientY, _rect: rect };
}

function loadWmImage(file) {
  if (!file || !file.type.startsWith('image/')) {
    setWmStatus('Please select a valid image.', true); return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      wmOriginalImage = img;
      setupWmCanvas(img);
      document.getElementById('wmUploadArea').style.display = 'none';
      document.getElementById('wmEditor').style.display = 'flex';
      if (!cvReady) {
        const el = document.getElementById('cvLoading');
        if (el) el.style.display = 'flex';
      }
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function setupWmCanvas(img) {
  const maxW = Math.min(img.width, 900);
  const scale = maxW / img.width;
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  [wmCanvas, wmMaskCanvas, wmResultCanvas].forEach(c => { c.width = w; c.height = h; });
  wmCtx.drawImage(img, 0, 0, w, h);
  wmMaskCtx.clearRect(0, 0, w, h);
  showCanvas('original');
  undoStack = []; resultBlob = null;
  document.getElementById('wmDownloadBtn').style.display = 'none';
  setWmStatus('Paint over watermarks, then click Remove.');
}

function getPos(ev) {
  const rect = wmCanvas.getBoundingClientRect();
  const scaleX = wmCanvas.width / rect.width;
  const scaleY = wmCanvas.height / rect.height;
  const x = ev._rect ? (ev.clientX - ev._rect.left) : (ev.clientX - rect.left);
  const y = ev._rect ? (ev.clientY - ev._rect.top)  : (ev.clientY - rect.top);
  return { x: x * scaleX, y: y * scaleY };
}

function startDraw(ev) {
  if (drawMode !== 'brush' || !wmOriginalImage) return;
  isDrawing = true; saveUndo(); paintMask(getPos(ev));
}
function drawMask(ev) { if (!isDrawing || drawMode !== 'brush') return; paintMask(getPos(ev)); }
function stopDraw() { isDrawing = false; }

function paintMask(pos) {
  wmMaskCtx.beginPath();
  wmMaskCtx.arc(pos.x, pos.y, brushSz / 2, 0, Math.PI * 2);
  wmMaskCtx.fillStyle = 'rgba(255,80,80,0.7)';
  wmMaskCtx.fill();
  wmCtx.clearRect(0, 0, wmCanvas.width, wmCanvas.height);
  wmCtx.drawImage(wmOriginalImage, 0, 0, wmCanvas.width, wmCanvas.height);
  wmCtx.drawImage(wmMaskCanvas, 0, 0);
}

function saveUndo() {
  undoStack.push(wmMaskCtx.getImageData(0, 0, wmMaskCanvas.width, wmMaskCanvas.height));
  if (undoStack.length > 20) undoStack.shift();
}

function undoMask() {
  if (!undoStack.length) return;
  wmMaskCtx.putImageData(undoStack.pop(), 0, 0);
  wmCtx.clearRect(0, 0, wmCanvas.width, wmCanvas.height);
  wmCtx.drawImage(wmOriginalImage, 0, 0, wmCanvas.width, wmCanvas.height);
  wmCtx.drawImage(wmMaskCanvas, 0, 0);
}

function clearMask() {
  saveUndo();
  wmMaskCtx.clearRect(0, 0, wmMaskCanvas.width, wmMaskCanvas.height);
  wmCtx.clearRect(0, 0, wmCanvas.width, wmCanvas.height);
  wmCtx.drawImage(wmOriginalImage, 0, 0, wmCanvas.width, wmCanvas.height);
  setWmStatus('Mask cleared.');
}

function setMode(mode) {
  drawMode = mode;
  document.getElementById('brushModeBtn').classList.toggle('active', mode === 'brush');
  document.getElementById('autoModeBtn').classList.toggle('active', mode === 'auto');
  if (mode === 'auto' && wmOriginalImage) autoDetect();
}

function autoDetect() {
  if (!cvReady) { setWmStatus('OpenCV loading...', true); return; }
  setWmStatus('Auto-detecting...');
  try {
    const src   = cv.imread(wmCanvas);
    const gray  = new cv.Mat();
    const edges = new cv.Mat();
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(15,15));
    const dilated = new cv.Mat();

    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.Canny(gray, edges, 100, 200);
    cv.dilate(edges, dilated, kernel);

    const tmp = document.createElement('canvas');
    tmp.width = wmCanvas.width; tmp.height = wmCanvas.height;
    cv.imshow(tmp, dilated);

    const td = tmp.getContext('2d').getImageData(0, 0, tmp.width, tmp.height);
    const od = wmMaskCtx.createImageData(wmMaskCanvas.width, wmMaskCanvas.height);
    for (let i = 0; i < td.data.length; i += 4) {
      if (td.data[i] > 128) { od.data[i]=255; od.data[i+1]=80; od.data[i+2]=80; od.data[i+3]=160; }
    }
    wmMaskCtx.clearRect(0, 0, wmMaskCanvas.width, wmMaskCanvas.height);
    wmMaskCtx.putImageData(od, 0, 0);
    wmCtx.clearRect(0, 0, wmCanvas.width, wmCanvas.height);
    wmCtx.drawImage(wmOriginalImage, 0, 0, wmCanvas.width, wmCanvas.height);
    wmCtx.drawImage(wmMaskCanvas, 0, 0);

    [src,gray,edges,kernel,dilated].forEach(m => m.delete());
    setWmStatus('Auto-detect done. Adjust if needed, then click Remove.');
  } catch(e) {
    console.error(e); setWmStatus('Auto-detect failed. Use brush.', true);
  }
}

async function removeWatermark() {
  if (!cvReady) { setWmStatus('OpenCV loading...', true); return; }
  if (!wmOriginalImage) { setWmStatus('Load an image first.', true); return; }

  const md = wmMaskCtx.getImageData(0,0,wmMaskCanvas.width,wmMaskCanvas.height);
  if (!md.data.some((v,i) => i%4===3 && v>10)) {
    setWmStatus('Paint the watermark area or use Auto Detect.', true); return;
  }

  setWmStatus('Removing watermark... ✨');
  document.getElementById('removeBtn').disabled = true;
  await new Promise(r => setTimeout(r,50));

  try {
    const sc = document.createElement('canvas');
    sc.width = wmCanvas.width; sc.height = wmCanvas.height;
    sc.getContext('2d').drawImage(wmOriginalImage, 0, 0, sc.width, sc.height);

    const bmc = document.createElement('canvas');
    bmc.width = sc.width; bmc.height = sc.height;
    const bx = bmc.getContext('2d');
    bx.fillStyle = 'black'; bx.fillRect(0,0,bmc.width,bmc.height);
    const bd = bx.getImageData(0,0,bmc.width,bmc.height);
    const cm = wmMaskCtx.getImageData(0,0,wmMaskCanvas.width,wmMaskCanvas.height);

    for (let i = 0; i < cm.data.length; i+=4) {
      if (cm.data[i+3] > 10) { bd.data[i]=255; bd.data[i+1]=255; bd.data[i+2]=255; bd.data[i+3]=255; }
    }
    bx.putImageData(bd, 0, 0);

    const src  = cv.imread(sc);
    const mMat = cv.imread(bmc);
    const dst  = new cv.Mat();
    const gm   = new cv.Mat();
    const sb   = new cv.Mat();

    cv.cvtColor(mMat, gm, cv.COLOR_RGBA2GRAY);
    cv.cvtColor(src,  sb, cv.COLOR_RGBA2BGR);

    const radius = parseInt(document.getElementById('inpaintRadius').value);
    cv.inpaint(sb, gm, dst, radius, cv.INPAINT_TELEA);

    const dr = new cv.Mat();
    cv.cvtColor(dst, dr, cv.COLOR_BGR2RGBA);

    wmResultCanvas.width = wmCanvas.width; wmResultCanvas.height = wmCanvas.height;
    cv.imshow(wmResultCanvas, dr);
    showCanvas('result');

    wmResultCanvas.toBlob(blob => {
      resultBlob = blob;
      document.getElementById('wmDownloadBtn').style.display = 'inline-flex';
    }, 'image/png');

    [src,mMat,dst,gm,sb,dr].forEach(m => m.delete());
    setWmStatus('✅ Done! Click Download to save.');
  } catch(e) {
    console.error(e); setWmStatus('❌ Error. Try adjusting mask/radius.', true);
  }
  document.getElementById('removeBtn').disabled = false;
}

function showCanvas(view) {
  const ob = document.querySelector('.canvas-tab-btn:nth-child(1)');
  const rb = document.querySelector('.canvas-tab-btn:nth-child(2)');
  if (view === 'original') {
    wmCanvas.style.display = 'block'; wmCanvas.classList.add('active-canvas');
    wmResultCanvas.style.display = 'none'; wmResultCanvas.classList.remove('active-canvas');
    if(ob) ob.classList.add('active'); if(rb) rb.classList.remove('active');
  } else {
    wmCanvas.style.display = 'none'; wmCanvas.classList.remove('active-canvas');
    wmResultCanvas.style.display = 'block'; wmResultCanvas.classList.add('active-canvas');
    if(rb) rb.classList.add('active'); if(ob) ob.classList.remove('active');
  }
}

function downloadWm() {
  if (!resultBlob) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(resultBlob);
  a.download = 'watermark_removed.png';
  a.click(); URL.revokeObjectURL(a.href);
}

function resetWmTool() {
  wmOriginalImage = null; undoStack = []; resultBlob = null;
  if(wmCtx) wmCtx.clearRect(0,0,wmCanvas.width,wmCanvas.height);
  if(wmMaskCtx) wmMaskCtx.clearRect(0,0,wmMaskCanvas.width,wmMaskCanvas.height);
  if(wmResultCtx) wmResultCtx.clearRect(0,0,wmResultCanvas.width,wmResultCanvas.height);
  document.getElementById('wmEditor').style.display = 'none';
  document.getElementById('wmUploadArea').style.display = 'flex';
  document.getElementById('wmFileInput').value = '';
  document.getElementById('wmDownloadBtn').style.display = 'none';
  setWmStatus('');
}

function setWmStatus(msg, err=false) {
  const el = document.getElementById('wmStatus');
  if(!el) return;
  el.textContent = msg;
  el.style.color = err ? '#ff6b6b' : 'var(--gold)';
}