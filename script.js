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

// --- 页面切换逻辑 ---
function goPage(n) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page${n}`).classList.add('active');
    
    if (n === 1) {
        stopCamera();
        // 如果回到首页，可以重置一些状态
    }
    if (n === 2) {
        rotationAngle = 0; // 重置旋转
        if (mode === 'camera') {
            startCamera();
        } else {
            // 如果是上传模式，需要确保Canvas重绘
            drawWatermarkOverlay();
        }
    }
}

// --- PAGE 1: 水印输入逻辑 ---
function selectTag(txt) {
    // 移除所有 active
    document.querySelectorAll('.tag').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    
    if (txt === '') {
        // 点击了自定义
        els.customInput.focus();
        updateCustomText();
    } else {
        currentText = txt;
        els.customInput.value = '';
        // 高亮显示关键字
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
        img.src = evt.target.result;
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
        
        // 监听视频元数据加载，调整水印层尺寸
        els.video.onloadedmetadata = () => {
            drawWatermarkOverlay();
        };
    } catch (err) {
        alert("无法访问摄像头，请检查权限或使用上传功能。\n(iOS请在Safari中使用)");
        console.error(err);
    }
}

function stopCamera() {
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
}

function setDensity(type) {
    density = type;
    document.querySelectorAll('.density-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    drawWatermarkOverlay();
}

function drawUploadPreview() {
    if (!originalImg) return;
    const cvs = els.imgCanvas;
    const parent = document.getElementById('viewport');
    
    // 计算适合屏幕的尺寸
    const mw = parent.clientWidth;
    const mh = parent.clientHeight;
    const scale = Math.min(mw / originalImg.width, mh / originalImg.height);
    
    cvs.width = originalImg.width * scale;
    cvs.height = originalImg.height * scale;
    
    const ctx = cvs.getContext('2d');
    ctx.drawImage(originalImg, 0, 0, cvs.width, cvs.height);
    
    // 设置水印层尺寸与图片一致
    els.overlayCanvas.width = cvs.width;
    els.overlayCanvas.height = cvs.height;
    drawWatermarkOverlay();
}

function drawWatermarkOverlay() {
    const cvs = els.overlayCanvas;
    const ctx = cvs.getContext('2d');
    
    if (mode === 'camera') {
        const vp = document.getElementById('viewport');
        cvs.width = vp.clientWidth;
        cvs.height = vp.clientHeight;
    }

    ctx.clearRect(0, 0, cvs.width, cvs.height);
    
    const conf = PRESETS[density];
    ctx.font = "bold 24px sans-serif";
    ctx.fillStyle = conf.color;
    ctx.globalAlpha = conf.alpha;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    // 旋转覆盖逻辑
    ctx.save();
    ctx.translate(cvs.width/2, cvs.height/2);
    ctx.rotate(-45 * Math.PI / 180);
    
    // 平铺范围计算（需要覆盖旋转后的区域）
    const diag = Math.sqrt(cvs.width**2 + cvs.height**2);
    ctx.translate(-diag, -diag);

    for (let y = 0; y < diag * 2; y += conf.gap) {
        for (let x = 0; x < diag * 2; x += (ctx.measureText(currentText).width + 60)) {
            ctx.fillText(currentText, x, y);
        }
    }
    ctx.restore();
}

function takePhoto() {
    const v = els.video;
    // 创建临时画布抓取这一帧
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
    // 稍微延迟以显示loading
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
    
    // 处理旋转后的画布尺寸
    if (rotationAngle === 90 || rotationAngle === 270) {
        cvs.width = originalImg.height;
        cvs.height = originalImg.width;
    } else {
        cvs.width = originalImg.width;
        cvs.height = originalImg.height;
    }

    // 1. 绘制底图
    ctx.save();
    ctx.translate(cvs.width/2, cvs.height/2);
    ctx.rotate(rotationAngle * Math.PI / 180);
    if (rotationAngle === 90 || rotationAngle === 270) {
         ctx.drawImage(originalImg, -originalImg.height/2, -originalImg.width/2);
    } else {
         ctx.drawImage(originalImg, -originalImg.width/2, -originalImg.height/2);
    }
    ctx.restore();

    // 2. 绘制水印（确保水印永远是45度倾斜，不随图片旋转而旋转）
    const conf = PRESETS[density];
    
    // 根据图片实际像素动态调整字体大小
    // 防止高清图上水印太小
    const scale = Math.max(cvs.width, cvs.height) / 1000; 
    const fontSize = Math.max(24, 30 * scale); // 最小24px
    const gap = conf.gap * (scale > 1 ? scale : 1);

    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.fillStyle = conf.color;
    ctx.globalAlpha = conf.alpha;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    const diag = Math.sqrt(cvs.width**2 + cvs.height**2);
    
    ctx.save();
    ctx.translate(cvs.width/2, cvs.height/2);
    ctx.rotate(-45 * Math.PI / 180); // 固定 -45 度
    ctx.translate(-diag, -diag);

    for (let y = 0; y < diag * 2; y += gap) {
        for (let x = 0; x < diag * 2; x += (ctx.measureText(currentText).width + (60 * scale))) {
            ctx.fillText(currentText, x, y);
        }
    }
    ctx.restore();
}

function saveImage() {
    const link = document.createElement('a');
    link.download = '水印证件_' + Date.now() + '.jpg';
    link.href = els.finalCanvas.toDataURL('image/jpeg', 0.95);
    link.click();
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
