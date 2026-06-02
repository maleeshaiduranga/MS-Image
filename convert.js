let cvFiles = [];
let convertedResults = [];
let _aspectRatios = {};

window.addEventListener('DOMContentLoaded', () => {
  setupDropZone('cvDropZone', 'cvFileInput', handleCvFiles);

  document.getElementById('qualityRange').addEventListener('input', e => {
    document.getElementById('qualityVal').textContent = e.target.value;
  });
  document.getElementById('resizeW').addEventListener('input', () => syncAspect('w'));
  document.getElementById('resizeH').addEventListener('input', () => syncAspect('h'));
  document.getElementById('outputFormat').addEventListener('change', () => {
    const fmt = document.getElementById('outputFormat').value;
    document.getElementById('qualityGroup').style.display =
      (fmt === 'image/jpeg' || fmt === 'image/webp') ? 'flex' : 'none';
  });
});

function handleCvFiles(fileList) {
  const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
  if (!files.length) { setCvStatus('No valid images.', true); return; }
  cvFiles = [...cvFiles, ...files];
  convertedResults = [];
  document.getElementById('cvResults').innerHTML = '';
  document.getElementById('downloadAllBtn').style.display = 'none';
  renderFileList();
  document.getElementById('cvUploadArea').style.display = 'none';
  document.getElementById('cvOptions').style.display = 'block';
  setCvStatus(`${cvFiles.length} file(s) ready.`);
}

function renderFileList() {
  const list = document.getElementById('cvFileList');
  list.innerHTML = '';
  cvFiles.forEach((file, i) => {
    const item = document.createElement('div');
    item.className = 'file-item'; item.id = `cv-file-${i}`;

    const thumb = document.createElement('img');
    thumb.className = 'file-thumb';
    const url = URL.createObjectURL(file);
    thumb.src = url;
    thumb.onload = () => URL.revokeObjectURL(url);

    const nm = document.createElement('span'); nm.className='file-name'; nm.textContent=file.name; nm.title=file.name;
    const sz = document.createElement('span'); sz.className='file-status'; sz.textContent=fmtBytes(file.size);

    const rb = document.createElement('button');
    rb.className='glass-btn'; rb.style.cssText='padding:4px 10px;font-size:11px;border-radius:8px;';
    rb.textContent='✕'; rb.onclick=()=>removeFile(i);

    item.append(thumb,nm,sz,rb); list.appendChild(item);

    const img = new Image();
    const u2 = URL.createObjectURL(file);
    img.onload = () => { _aspectRatios[i] = img.height/img.width; URL.revokeObjectURL(u2); };
    img.src = u2;
  });
}

function removeFile(i) {
  cvFiles.splice(i,1); delete _aspectRatios[i];
  if (!cvFiles.length) { resetCvTool(); return; }
  renderFileList(); setCvStatus(`${cvFiles.length} file(s) ready.`);
}

function syncAspect(changed) {
  if (!document.getElementById('keepAspect').checked) return;
  const r = _aspectRatios[0]; if(!r) return;
  if (changed==='w') {
    const w = parseInt(document.getElementById('resizeW').value);
    if (w>0) document.getElementById('resizeH').value = Math.round(w*r);
  } else {
    const h = parseInt(document.getElementById('resizeH').value);
    if (h>0) document.getElementById('resizeW').value = Math.round(h/r);
  }
}

async function convertAll() {
  if (!cvFiles.length) return;
  const fmt  = document.getElementById('outputFormat').value;
  const qual = parseInt(document.getElementById('qualityRange').value)/100;
  const tw   = parseInt(document.getElementById('resizeW').value)||0;
  const th   = parseInt(document.getElementById('resizeH').value)||0;
  const keep = document.getElementById('keepAspect').checked;

  convertedResults = [];
  document.getElementById('cvResults').innerHTML='';
  document.getElementById('downloadAllBtn').style.display='none';
  setCvStatus('Converting...');

  const extMap = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/bmp':'bmp','image/gif':'gif'};
  const ext = extMap[fmt]||'png';

  for (let i=0;i<cvFiles.length;i++) {
    const item = document.getElementById(`cv-file-${i}`);
    try {
      const blob = await convertImg(cvFiles[i],fmt,qual,tw,th,keep);
      const name = cvFiles[i].name.replace(/\.[^/.]+$/,'')+`_converted.${ext}`;
      convertedResults.push({blob,name});
      if(item){item.classList.add('done');const s=item.querySelector('.file-status');if(s)s.textContent=`✅ ${fmtBytes(blob.size)}`;}
      addResultCard(blob,name);
    } catch(e) {
      console.error(e);
      if(item){item.classList.add('error');const s=item.querySelector('.file-status');if(s)s.textContent='❌ Error';}
    }
  }

  if (convertedResults.length) {
    setCvStatus(`✅ ${convertedResults.length} file(s) converted!`);
    if(convertedResults.length>1) document.getElementById('downloadAllBtn').style.display='inline-flex';
  } else { setCvStatus('❌ Conversion failed.',true); }
}

function convertImg(file,fmt,quality,tw,th,keep) {
  return new Promise((res,rej) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let ow=img.width, oh=img.height;
      if(tw>0&&th>0){ if(keep){const r=Math.min(tw/ow,th/oh);ow=Math.round(ow*r);oh=Math.round(oh*r);}else{ow=tw;oh=th;} }
      else if(tw>0){ ow=tw; if(keep) oh=Math.round(img.height*(tw/img.width)); }
      else if(th>0){ oh=th; if(keep) ow=Math.round(img.width*(th/img.height)); }

      const c=document.createElement('canvas'); c.width=ow; c.height=oh;
      const x=c.getContext('2d');
      if(fmt==='image/jpeg'||fmt==='image/bmp'){x.fillStyle='#fff';x.fillRect(0,0,ow,oh);}
      x.drawImage(img,0,0,ow,oh);
      const q=(fmt==='image/jpeg'||fmt==='image/webp')?quality:undefined;
      c.toBlob(b=>{ if(b)res(b); else rej(new Error('fail')); },fmt,q);
    };
    img.onerror=()=>{URL.revokeObjectURL(url);rej(new Error('load fail'));};
    img.src=url;
  });
}

function addResultCard(blob,name) {
  const r=document.getElementById('cvResults');
  const card=document.createElement('div'); card.className='result-card glass-card';
  const url=URL.createObjectURL(blob);
  const t=document.createElement('img'); t.className='result-thumb'; t.src=url;
  const n=document.createElement('div'); n.className='result-name'; n.textContent=name; n.title=name;
  const b=document.createElement('button'); b.className='glass-btn gold-btn result-dl-btn'; b.textContent='⬇️ Download';
  b.onclick=()=>{ const a=document.createElement('a'); a.href=url; a.download=name; a.click(); };
  card.append(t,n,b); r.appendChild(card);
}

async function downloadAll() {
  for(const {blob,name} of convertedResults){
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click();
    URL.revokeObjectURL(a.href);
    await new Promise(r=>setTimeout(r,300));
  }
}

function resetCvTool() {
  cvFiles=[]; convertedResults=[]; _aspectRatios={};
  document.getElementById('cvOptions').style.display='none';
  document.getElementById('cvUploadArea').style.display='flex';
  document.getElementById('cvFileInput').value='';
  document.getElementById('cvFileList').innerHTML='';
  document.getElementById('cvResults').innerHTML='';
  document.getElementById('downloadAllBtn').style.display='none';
  setCvStatus('');
}

function setCvStatus(msg,err=false) {
  const el=document.getElementById('cvStatus'); if(!el)return;
  el.textContent=msg; el.style.color=err?'#ff6b6b':'var(--gold)';
}

function fmtBytes(b) {
  if(b<1024)return b+' B';
  if(b<1048576)return (b/1024).toFixed(1)+' KB';
  return (b/1048576).toFixed(2)+' MB';
}