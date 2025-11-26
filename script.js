// 全局变量与配置
const { jsPDF } = window.jspdf;
let currentText = "仅供办理业务使用，他用无效";
let mode = 'camera'; // 'camera' or 'upload'
let density = 'normal'; // sparse, normal, dense
let rotationAngle = 0;
let originalImg = null; // 上传或拍摄的原始图
let videoStream = null;

// 预设参数
const PRESETS = {
    sparse: { gap: 300, alpha: 0.25, color: '#808080' },
    normal: { gap: 200, alpha: 0.20, color: '#808080' },
    dense:  { gap: 120, alpha: 0.15, color: '#808080' }
};

// DOM 元素快捷引用
const els = {
    page1: document.getElementById('page1'),
    page2: document.getElementById('page2'),
    page3: document.getElementById('page3'),
    textPreview: document.getElementById('textPreview'),
    customInput: document.getElementById('customInput'),
    video: document.getElementById('video'),
    imgCanvas: document.getElementById('imgCanvas'),
    overlayCanvas: document.getElementById('overlayCanvas'),
    finalCanvas: document.getElementById('finalCanvas'),
    fileInput: document.getElementById('fileInput'),
    loading: document.getElementById('loading')
};

window.addEventListener('beforeunload', stopCamera);

function setOverlaySize(width, height) {
    els.overlayCanvas.width = width;
    els.overlayCanvas.height = height;
    els.overlayCanvas.style.width = `${width}px`;
    els.overlayCanvas.style.height = `${height}px`;
}

// --- 页面切换逻辑 ---
function goPage(n) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page${n}`).classList.add('active');

    if (n === 1) {
        stopCamera();
    }
    if (n !== 2) {
        setOverlaySize(0, 0);
    }
    if (n === 2) {
        rotationAngle = 0; // 重置旋转
        if (mode === 'camera') {
            startCamera();
        } else {
            drawWatermarkOverlay();
        }
    }
}

// --- PAGE 1: 水印输入逻辑 ---
function selectTag(txt, evt) {
    document.querySelectorAll('.tag').forEach(b => b.classList.remove('active'));
    if (evt && evt.target) {
        evt.target.classList.add('active');
    }
    
    if (txt === '') {
        els.customInput.focus();
        updateCustomText();
    } else {
        currentText = txt;
        els.customInput.value = '';
        els.textPreview.innerHTML = txt;
    }
}

function updateCustomText() {
    const val = els.customInput.value.trim();
    currentText = val || "仅供办理业务使用，他用无效";
    els.textPreview.innerHTML = `该证件仅供办理 <span class="highlight">${currentText}</span> 使用`;
}

function startCameraMode() {
    mode = 'camera';
    document.getElementById('page2Title').innerText = "拍摄证件";
    document.getElementById('shutterBtn').style.display = 'block';
    document.getElementById('nextBtn').style.display = 'none';
    els.video.style.display = 'block';
    els.imgCanvas.style.display = 'none';
    goPage(2);
}

function startUploadMode() {
    els.fileInput.click();
}

els.fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    mode = 'upload';
    document.getElementById('page2Title').innerText = "图片预览";
    document.getElementById('shutterBtn').style.display = 'none';
    document.getElementById('nextBtn').style.display = 'block';
    els.video.style.display = 'none';
    els.imgCanvas.style.display = 'block';
    
    els.loading.style.display = 'flex';

    const reader = new FileReader();
    reader.onload = (evt) => {
        const img = new Image();
        img.onload = () => {
            originalImg = img;
            drawUploadPreview();
            els.loading.style.display = 'none';
            goPage(2);
        };
        img.onerror = () => {
            els.loading.style.display = 'none';
            alert("图片加载失败，请重试或选择其他文件。");
        };
        img.src = evt.target.result;
    };
    reader.onerror = () => {
        els.loading.style.display = 'none';
        alert("文件读取失败，请重试或选择其他文件。");
    };
    reader.readAsDataURL(file);
});

// --- PAGE 2: 拍摄/预览逻辑 ---
async function startCamera() {
    try {
        videoStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" }
        });
        els.video.srcObject = videoStream;
        els.video.onloadedmetadata = () => {
            drawWatermarkOverlay();
        };
    } catch (err) {
        alert("无法访问摄像头，请检查权限或使用上传功能。");
    }
}

function stopCamera() {
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
}

function setDensity(type, evt) {
    density = type;
    document.querySelectorAll('.density-btn').forEach(b => b.classList.remove('active'));
    if (evt && evt.target) {
        evt.target.classList.add('active');
    }
    drawWatermarkOverlay();
}

function drawUploadPreview() {
    if (!originalImg) return;
    const cvs = els.imgCanvas;
    const parent = document.getElementById('viewport');
    
    const mw = parent.clientWidth;
    const mh = parent.clientHeight;
    const scale = Math.min(mw / originalImg.width, mh / originalImg.height);

    cvs.width = originalImg.width * scale;
    cvs.height = originalImg.height * scale;
    
    const ctx = cvs.getContext('2d');
    ctx.drawImage(originalImg, 0, 0, cvs.width, cvs.height);

    setOverlaySize(cvs.width, cvs.height);
    drawWatermarkOverlay();
}

function drawWatermarkOverlay() {
    const cvs = els.overlayCanvas;
    const ctx = cvs.getContext('2d');

    if (mode === 'camera') {
        const vp = document.getElementById('viewport');
        const vw = vp.clientWidth;
        const vh = vp.clientHeight;
        const video = els.video;
        const ratio = (video.videoWidth && video.videoHeight) ? video.videoWidth / video.videoHeight : vw / vh;

        let renderW = vw;
        let renderH = renderW / ratio;
        if (renderH > vh) {
            renderH = vh;
            renderW = renderH * ratio;
        }

        setOverlaySize(renderW, renderH);
    }

    if (!cvs.width || !cvs.height) return;

    ctx.clearRect(0, 0, cvs.width, cvs.height);

    const params = getWatermarkParams(cvs.width, cvs.height);
    setWatermarkStyle(ctx, params);
    paintWatermark(ctx, cvs.width, cvs.height, params, 0);
}

function takePhoto() {
    const v = els.video;
    const cvs = document.createElement('canvas');
    cvs.width = v.videoWidth;
    cvs.height = v.videoHeight;
    cvs.getContext('2d').drawImage(v, 0, 0);
    
    const img = new Image();
    img.onload = () => {
        originalImg = img;
        processImage();
    };
    img.src = cvs.toDataURL('image/jpeg');
}

function processImage() {
    stopCamera();
    els.loading.style.display = 'flex';
    setTimeout(() => {
        generateFinalResult();
        goPage(3);
        els.loading.style.display = 'none';
    }, 100);
}

// --- PAGE 3: 结果/导出逻辑 ---
function rotateImage() {
    rotationAngle = (rotationAngle + 90) % 360;
    generateFinalResult();
}

function generateFinalResult() {
    if (!originalImg) return;
    const cvs = els.finalCanvas;
    const ctx = cvs.getContext('2d');

    if (rotationAngle === 90 || rotationAngle === 270) {
        cvs.width = originalImg.height;
        cvs.height = originalImg.width;
    } else {
        cvs.width = originalImg.width;
        cvs.height = originalImg.height;
    }

    ctx.clearRect(0, 0, cvs.width, cvs.height);

    ctx.save();
    ctx.translate(cvs.width/2, cvs.height/2);
    ctx.rotate(rotationAngle * Math.PI / 180);
    if (rotationAngle === 90 || rotationAngle === 270) {
         ctx.drawImage(originalImg, -originalImg.height/2, -originalImg.width/2);
    } else {
         ctx.drawImage(originalImg, -originalImg.width/2, -originalImg.height/2);
    }
    ctx.restore();

    const params = getWatermarkParams(cvs.width, cvs.height);
    setWatermarkStyle(ctx, params);
    paintWatermark(ctx, cvs.width, cvs.height, params, rotationAngle * Math.PI / 180);
}

function getWatermarkParams(width, height) {
    const conf = PRESETS[density];
    const scale = Math.max(width, height) / 1000;
    const safeScale = Math.max(1, scale);

    return {
        fontSize: Math.max(24, 30 * scale),
        gap: conf.gap * safeScale,
        textSpacing: 60 * safeScale,
        color: conf.color,
        alpha: conf.alpha
    };
}

function setWatermarkStyle(ctx, params) {
    ctx.font = `bold ${params.fontSize}px sans-serif`;
    ctx.fillStyle = params.color;
    ctx.globalAlpha = params.alpha;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
}

function paintWatermark(ctx, width, height, params, rotationRad = 0) {
    const diag = Math.sqrt(width ** 2 + height ** 2);
    const stepX = ctx.measureText(currentText).width + params.textSpacing;

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(rotationRad - 45 * Math.PI / 180);
    ctx.translate(-diag / 2, -diag / 2);

    for (let y = -diag; y <= diag; y += params.gap) {
        for (let x = -diag; x <= diag; x += stepX) {
            ctx.fillText(currentText, x, y);
        }
    }
    ctx.restore();
}

// --- 核心修改：适配 iOS 的保存逻辑 ---
function saveImage() {
    const dataURL = els.finalCanvas.toDataURL('image/jpeg', 0.95);
    
    // 检测 iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    if (isIOS) {
        // 尝试调用原生分享 (Web Share API Level 2)
        if (navigator.share) {
            fetch(dataURL)
                .then(res => res.blob())
                .then(blob => {
                    const file = new File([blob], 'watermark.jpg', { type: 'image/jpeg' });
                    navigator.share({
                        files: [file]
                    }).catch((err) => {
                        // 用户取消分享不做处理
                        console.log('Share canceled', err);
                    });
                });
        } else {
            // 降级方案：弹窗长按
            const newWin = window.open();
            if (newWin) {
                newWin.document.write(`<body style="background:#000; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; margin:0;">`);
                newWin.document.write(`<img src="${dataURL}" style="max-width:100%; max-height:80vh; box-shadow:0 0 20px rgba(255,255,255,0.2);">`);
                newWin.document.write(`<h2 style="color:#fff; font-family:sans-serif; margin-top:20px; font-size:16px;">请长按图片选择"存储到照片"</h2>`);
                newWin.document.write(`</body>`);
            } else {
                alert("请长按图片保存");
            }
        }
    } else {
        // Android/PC 直接下载
        const link = document.createElement('a');
        link.download = '水印证件_' + Date.now() + '.jpg';
        link.href = dataURL;
        link.click();
    }
}

function exportPDF() {
    const cvs = els.finalCanvas;
    const imgData = cvs.toDataURL('image/jpeg', 0.95);
    const orientation = cvs.width > cvs.height ? 'l' : 'p';
    
    const doc = new jsPDF({
        orientation: orientation,
        unit: 'px',
        format: [cvs.width, cvs.height]
    });
    
    doc.addImage(imgData, 'JPEG', 0, 0, cvs.width, cvs.height);
    doc.save('水印证件_' + Date.now() + '.pdf');
}
