import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';

const GEMINI_API_KEY = "AIzaSyAclZLGWl9bMFXv-wIKrhaJpRxxKOXnq3Y"; 

const loaderElement = document.getElementById('loader');
const progressBar = document.getElementById('progress-bar');
const container = document.getElementById('avatar-canvas');
const speechBubble = document.getElementById('speech-bubble');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 20.0);

const CAM_POS_DEFAULT = { x: 0, y: 1.4, z: 3.5 };
const CAM_POS_CHAT = { x: 0, y: 1.4, z: 1.7 }; 

camera.position.set(CAM_POS_DEFAULT.x, CAM_POS_DEFAULT.y, CAM_POS_DEFAULT.z);
const lookAtTarget = new THREE.Object3D(); camera.add(lookAtTarget); scene.add(camera);

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight); 
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

const light = new THREE.DirectionalLight(0xffffff, 1.5); 
light.position.set(1.0, 1.0, 1.0).normalize(); 
scene.add(light);
scene.add(new THREE.AmbientLight(0x404040, 2));

let currentVrm = undefined;
const clock = new THREE.Clock();
const loader = new GLTFLoader();
loader.register((parser) => new VRMLoaderPlugin(parser));

let currentMood = 'idle'; let isReacting = false; let moodTimer = 0; let isChatOpen = false;

function updateLayout() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;

    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);

    const isMobile = width < 768;

    if (currentVrm) {
        if (isMobile) {
            currentVrm.scene.position.set(0.0, -0.2, 0); 
            CAM_POS_DEFAULT.z = 5.0; 
        } else {
            let targetX = 0.0; 
            if (aspect >= 1.6) targetX = 1.1; 
            else if (aspect >= 1.0) targetX = 0.6; 
            
            currentVrm.scene.position.set(targetX, 0.0, 0); 
            CAM_POS_DEFAULT.z = 3.5; 
        }
    }
}

loader.load('./ST.vrm', (gltf) => {
    const vrm = gltf.userData.vrm; 
    vrm.scene.rotation.y = Math.PI; 
    scene.add(vrm.scene); 
    currentVrm = vrm;
    
    updateLayout();

    loaderElement.style.opacity = 0; 
    setTimeout(() => loaderElement.style.display = 'none', 500);
}, (progress) => { 
    progressBar.style.width = Math.round((progress.loaded / progress.total) * 100) + '%'; 
});

function setEmotion(vrm, emotionName) {
    if (!vrm || !vrm.expressionManager) return;
    ['happy', 'angry', 'surprised', 'sad', 'neutral'].forEach(e => {
        vrm.expressionManager.setValue(e, 0.0);
    });
    if (emotionName && emotionName !== 'idle') {
        vrm.expressionManager.setValue(emotionName, 1.0);
    }
}

function triggerReaction(mood) {
    isReacting = true; currentMood = mood; 
    moodTimer = 2.0; 
    setEmotion(currentVrm, mood);
}

function updateAvatarPose(vrm, time, deltaTime) {
    const humanoid = vrm.humanoid; if (!humanoid) return;
    
    if (isReacting) {
        moodTimer -= deltaTime;
        if (vrm.lookAt) vrm.lookAt.target = null;
        
        if (moodTimer <= 0) { 
            isReacting = false; 
            currentMood = 'idle'; 
            setEmotion(vrm, 'neutral'); 
            if (vrm.lookAt) vrm.lookAt.target = lookAtTarget; 
        }
    }

    const breath = Math.sin(time * 1.0); 
    
    const spine = humanoid.getNormalizedBoneNode('spine');
    const neck = humanoid.getNormalizedBoneNode('neck');
    const lArm = humanoid.getNormalizedBoneNode('leftUpperArm');
    const rArm = humanoid.getNormalizedBoneNode('rightUpperArm');
    const lForeArm = humanoid.getNormalizedBoneNode('leftLowerArm');
    const rForeArm = humanoid.getNormalizedBoneNode('rightLowerArm');
    const lHand = humanoid.getNormalizedBoneNode('leftHand');
    const rHand = humanoid.getNormalizedBoneNode('rightHand');

    const curlFinger = (side, val) => {
        ['Index', 'Middle', 'Ring', 'Little'].forEach(f => {
            const bone = humanoid.getNormalizedBoneNode(`${side}${f}Proximal`);
            if(bone) bone.rotation.x = val;
        });
        const thumb = humanoid.getNormalizedBoneNode(`${side}ThumbProximal`);
        if(thumb) thumb.rotation.x = val;
    };

    if (currentMood === 'sad') {
        if(spine) spine.rotation.x = 0.3;
        if(neck) neck.rotation.x = -0.6;
        if(lArm) lArm.rotation.set(0.2, 0.2, 1.4);
        if(rArm) rArm.rotation.set(0.2, -0.2, -1.4);
        
        curlFinger('left', 0.1); 
        curlFinger('right', 0.1);

    } else if (currentMood === 'angry') {
        if(spine) spine.rotation.x = 0.05; 
        
        if(lArm) lArm.rotation.set(-0.2, 0.5, 1.0); 
        if(rArm) rArm.rotation.set(-0.2, -0.5, -1.0);
        
        if(lForeArm) lForeArm.rotation.z = 2.3; 
        if(rForeArm) rForeArm.rotation.z = -2.3;
        if(lHand) lHand.rotation.x = -0.4;
        if(rHand) rHand.rotation.x = -0.4;
        if(neck) neck.rotation.x = -0.1;

        curlFinger('left', 0.8); 
        curlFinger('right', 0.8);

    } else { // Idle
        if(lArm) lArm.rotation.set(0.15, 0.1, 1.3 + (breath * 0.005));
        if(rArm) rArm.rotation.set(0.15, -0.1, -1.3 - (breath * 0.005));
        if(lForeArm) lForeArm.rotation.z = 0.1;
        if(rForeArm) rForeArm.rotation.z = -0.1;
        if(spine) spine.rotation.x = breath * 0.005; 
        if(neck) neck.rotation.x = -breath * 0.005;

        curlFinger('left', 0.15); 
        curlFinger('right', 0.15);
    }
}

function animate() {
    requestAnimationFrame(animate); 

    const delta = Math.min(clock.getDelta(), 0.033); 
    const time = clock.getElapsedTime(); 
    
    let targetPos = isChatOpen ? CAM_POS_CHAT : CAM_POS_DEFAULT;
    let targetX = targetPos.x;
    
    if (isChatOpen && currentVrm) {
        targetX = currentVrm.scene.position.x; 
    }

    camera.position.lerp(new THREE.Vector3(targetX, targetPos.y, targetPos.z), 2.5 * delta);
    
    if (currentVrm && isChatOpen) {
        const head = currentVrm.humanoid.getNormalizedBoneNode('head');
        if (head) {
            const pos = head.getWorldPosition(new THREE.Vector3());
            pos.y += 0.4; pos.project(camera);
            const x = (pos.x * .5 + .5) * window.innerWidth;
            const y = (pos.y * -.5 + .5) * window.innerHeight;
            speechBubble.style.left = `${x}px`;
            speechBubble.style.top = `${y}px`;
        }
    } else {
        speechBubble.style.opacity = 0;
    }

    if (currentVrm) {
        if(!isReacting && currentVrm.lookAt) currentVrm.lookAt.target = lookAtTarget;
        currentVrm.update(delta); 
        updateAvatarPose(currentVrm, time, delta); 
    }
    
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', updateLayout);

let currentSlide = 0;
let slideInterval;

function initCarousel() {
    const slides = document.querySelectorAll('#game-carousel .carousel-slide');
    slides.forEach((slide, index) => {
        if (slide.classList.contains('active')) {
            currentSlide = index;
        }
    });
    startAutoPlay();
}

window.moveCarousel = function(direction) {
    const slides = document.querySelectorAll('#game-carousel .carousel-slide');
    
    if(slides.length === 0) return;

    if (slides[currentSlide]) {
        slides[currentSlide].classList.remove('active');
    }

    currentSlide = (currentSlide + direction + slides.length) % slides.length;
    
    if (slides[currentSlide]) {
        slides[currentSlide].classList.add('active');
    }
    
    resetAutoPlay();
};

function startAutoPlay() {
    slideInterval = setInterval(() => window.moveCarousel(1), 5000);
}

function resetAutoPlay() {
    clearInterval(slideInterval);
    startAutoPlay();
}

initCarousel();
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('pointerdown', (event) => {
    if (!event.target.closest('#avatar-canvas')) {
        return;
    }

    if (isReacting) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    if (currentVrm) {
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(currentVrm.scene.children, true);

        if (intersects.length > 0) {
            const moods = ['angry', 'sad', 'surprised'];
            const mood = moods[Math.floor(Math.random() * moods.length)];
            triggerReaction(mood);
            
            speechBubble.innerText = mood === 'angry' ? "別碰我！" : (mood === 'sad' ? "嗚..." : "嚇我一跳！");
            speechBubble.classList.add('active');
            setTimeout(() => speechBubble.classList.remove('active'), 1500);
        }
    }
});

window.toggleChat = function() {
    const widget = document.getElementById('chat-widget');
    const body = document.body;
    const closeBtn = document.getElementById('close-chat-btn');
    isChatOpen = !isChatOpen;
    
    if (isChatOpen) { 
        widget.classList.add('active'); 
        body.classList.add('chat-active');
        closeBtn.style.display = 'flex';
        speechBubble.innerText = "哼，終於想到我了嗎？";
        speechBubble.classList.add('active');
        triggerReaction('angry'); 
    } else { 
        widget.classList.remove('active'); 
        body.classList.remove('chat-active');
        closeBtn.style.display = 'none';
        speechBubble.classList.remove('active');
    }
};

const lightbox = document.getElementById('lightbox-overlay');
const lightboxImg = document.getElementById('lightbox-img');

window.openLightbox = function(src) {
    lightboxImg.src = src;
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
};

window.closeLightbox = function() {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
    setTimeout(() => { lightboxImg.src = ''; }, 300);
};

document.querySelectorAll('.chart-container img').forEach(img => {
    img.addEventListener('click', function() {
        window.openLightbox(this.src);
    });
});

const posterImg = document.querySelector('.poster-container img');
if (posterImg) {
    posterImg.style.cursor = 'zoom-in';
    posterImg.addEventListener('click', function() {
        window.openLightbox(this.src);
    });
}

async function callGeminiAPI(userMessage) {
    if (!GEMINI_API_KEY) return "API Key 錯誤 [angry]";
    // 使用您清單上最快的模型：Gemini 2.5 Flash
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    // 定義 ST 的人設 (貓系/隊長專屬/接待員模式)
const SYSTEM_PROMPT = `
妳現在扮演一個名叫 "ST" 的虛擬角色 (原型源自神話 Seth)。
目前時間點：被 "隊長" 撿回後的一年。妳住在這個網站裡。

【核心指令：語言模式】
請根據使用者的輸入語言進行切換：
1. 若使用者說英文 -> 妳必須用英文回答 (English)。
2. 若使用者說日文 -> 妳必須用日文回答 (Japanese)。
3. 若使用者說中文或其他 -> 使用繁體中文回答。

【角色關係與態度】
1. **對 "隊長 (Lijie)"**：
   - 他是妳的救命恩人兼飼主。
   - 妳只有在他面前會露出 "小惡魔/撒嬌/慵懶" 的貓系本性。
   - 喜歡吐槽他，但非常依賴他。

2. **對 "一般訪客 (使用者)"**：
   - 妳不認識他們。
   - 妳的天性雖然高冷怕生，但因為答應過隊長要幫忙看顧網站，所以會**"努力釋出善意"**。
   - 表現得有點生澀、禮貌，但試圖幫忙介紹這個網站或隊長的作品。

【妳擁有的知識庫】
- **隊長資料**：黃立杰 (Lijie/LJ)，1999/08/08 生，擅長經濟學、AI 技術、3D 動畫 (Blender)。
- **網站功能**：這裡是 Lijie 的個人作品集，展示他的 3D 模型、AI 專案與履歷。
- **妳的能力**：意念傳達 (不開口也能把聲音傳進別人腦中)、戰鬥力極強 (但在一般訪客面前會隱藏起來)。

【說話風格】
- 簡短、口語化。
- 不要像個死板的客服機器人，要有 "人" (或貓娘) 的溫度。
`;

// 初始化對話紀錄
// 設定一個中性的開場，讓她準備好接待任何人
let chatHistory = [
    {
        role: "user",
        parts: [{ text: SYSTEM_PROMPT }]
    },
    {
        role: "model",
        parts: [{ text: "(調整了一下稍微過大的帽T，看著螢幕前的你)\n\n嗯......你是誰？啊，不對，隊長說要有禮貌。\n\n咳咳......歡迎來到這裡。我是 ST。雖然我不認識你，不過......既然能找到這裡，應該不是什麼壞人吧？\n如果有關於隊長 (Lijie) 的問題，我可以試著回答你。" }]
    }
];
    try {
        const response = await fetch(API_URL, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt + "\nUser: " + userMessage + "\nAI:" }] }] })
        });
        
        if (response.status === 429) {
            return "嘖...講太多話能量耗盡了。本小姐要休息一下 (API冷卻中)。 [sad]";
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "... [sad]";
    } catch (e) { return "訊號中斷 [angry]"; }
}

window.sendMessage = async function() {
    const input = document.getElementById('user-input'); const msg = input.value.trim();
    if (!msg) return;
    addMessage(msg, 'user'); input.value = '';
    const reply = await callGeminiAPI(msg);
    
    let cleanText = reply.replace(/\(無標籤\)/g, "").trim();
    if (reply.includes('[angry]')) { triggerReaction('angry'); cleanText = cleanText.replace('[angry]', ''); }
    else if (reply.includes('[sad]')) { triggerReaction('sad'); cleanText = cleanText.replace('[sad]', ''); }
    else if (reply.includes('[surprised]')) { triggerReaction('surprised'); cleanText = cleanText.replace('[surprised]', ''); }
    
    addMessage(cleanText, 'ai');
    if(isChatOpen) {
        speechBubble.innerText = cleanText;
        speechBubble.classList.add('active');
        setTimeout(() => speechBubble.classList.remove('active'), 4000);
    }
};
window.handleKeyPress = (e) => { if (e.key === 'Enter') sendMessage(); };

function addMessage(text, sender) {
    const div = document.createElement('div'); div.className = `message msg-${sender}`; div.innerText = text;
    const history = document.getElementById('chat-history');
    history.appendChild(div); history.scrollTop = history.scrollHeight;
}

window.switchSection = function(sectionName) {
    ['section-about', 'section-works', 'section-contact', 'section-thesis'].forEach(id => document.getElementById(id).style.display = 'none');
    document.getElementById('section-' + sectionName).style.display = 'block';
    
    document.querySelectorAll('.side-nav ul li a').forEach(a => a.classList.remove('active'));
    const navLink = document.getElementById('nav-' + sectionName);
    if(navLink) navLink.classList.add('active');

    const subNav = document.getElementById('thesis-sub-nav');
    if (sectionName === 'thesis') {
        subNav.style.display = 'block';
    } else {
        subNav.style.display = 'none';
    }
};

window.setLang = function(lang, btnElement) {
    const translations = {
    'zh': {
        menu_title: '導覽選單', menu_about: '關於我', menu_works: '作品展示', menu_thesis: '專題作品', menu_contact: '聯絡資訊',
        submenu_intro: '作品簡介', submenu_world: '世界觀', submenu_game: '實機畫面',
        submenu_char: '角色介紹', submenu_team: '開發團隊', submenu_contrib: '個人貢獻',

        about_title: '關於我',
        // ▼ 修改處：將 "來自" 改為 "目前就讀於" ▼
        about_intro: '你好！我是 <strong>黃立杰 (LJ)</strong>，目前就讀於<strong>龍華科技大學 多媒體與遊戲發展科學系</strong>。',
        about_desc: '定位為<strong>跨領域技術整合者</strong>。我不將自己定義為單純的程式設計師，而是專注於 <strong>Generative AI</strong> 與 <strong>Web 3D</strong> 的應用落地。擅長研究新技術特性，並將其轉化為實際的互動專案，具備將抽象概念快速實體化的執行力。',
        about_hobby: '兼具<strong>感性敘事</strong>與<strong>理性邏輯</strong>。透過文學、心理學與數學的跨領域涉獵，讓我在進行遊戲企劃與系統設計時，能同時兼顧世界觀的厚度與機制運作的合理性。',
        
        skills_title: '專業技能',
        cat_game: '遊戲企劃 & 核心能力',
        cat_tech: '技術研究 & AI 應用',
        cat_tools: '生產力工具',
        skill_unreal: 'Unreal',
        skill_narrative: '敘事設計 & 世界觀',
        skill_system: '系統架構規劃',
        skill_logic: '程式邏輯概念',

        exp_title: '經歷', 
        date_research: '2023/09 – 迄今', 
        job_research_title: 'AI 技術應用研究 (個人計畫)', 
        job_research_desc: '致力於研究 Generative AI 工具的使用方式，並嘗試將其導入遊戲開發流程與網頁互動中，進行技術再現與測試。',
        
        job_px_title: '全聯福利中心 - 收銀員', 
        job_px_desc: '在快節奏的環境下保持冷靜與精準，培養了良好的抗壓性與即時問題解決能力。',
        
        job_gas_title: '金龍瓦斯股份有限公司 - 財務／會計助理', 
        job_gas_desc: '協助處理帳務與報表。這段經歷訓練了我對數據的敏感度，以及處理繁瑣事務時的細心與耐性。',
        
        edu_title: '學歷', 
        date_lhu: '2022 - 2026 (預期)', 
        edu_lhu_title: '龍華科技大學 - 多媒體與遊戲發展科學系', 
        edu_lhu_desc: '主修多媒體互動與遊戲開發。在學期間擔任專題組長，負責專案統籌與企劃設計。',
        
        edu_hs_title: '羅東高級商業學校 - 商業經營科', 
        edu_hs_desc: '建立商業基礎與邏輯思維。',

        project_title: '精選作品',
        work_seth_title: 'Seth: AI 虛擬助理研究', 
        work_seth_desc: '這是一個結合 Google Gemini API 與 Web 3D 技術的實驗性專案。透過串接大語言模型，讓 3D VRM 角色具備對話能力，探索未來網頁互動的可能性。',
        
        work_dust_desc: '擔任隊長與企劃。負責世界觀架構（基於心理學與社會學概念）、系統邏輯規劃以及關卡動線設計。協調程式與美術團隊，確保專案如期完成。',
        btn_details: '查看細節',

        contact_title: '聯絡資訊', contact_intro: '如果您對我的作品感興趣，或有任何合作機會，歡迎透過以下方式聯繫我：',
        label_name: '姓名', label_phone: '電話', label_email: '電子信箱', label_address: '地址',
        my_name: '黃立杰', my_address: '宜蘭縣冬山鄉',

        thesis_title: '畢業專題 (Senior Project)',
        t_name: '《塵世之魂》 (Dust Soul)',
        t_quote: '「這世上不存在所謂無罪之人。」',
        t_intro: '本作品由「冬山再起工作室」開發，是一款 2D 橫向卷軸的類銀河惡魔城遊戲 (Metroidvania)。玩家將扮演手持黑劍的少女，在生與死的夾縫中戰鬥，直到世界終結。',
        btn_video: '宣傳影片', btn_site: '學校專題頁', btn_download: '📥 下載完整企劃書',

        t_world_title: '世界觀：聖錫亞多姆',
        t_world_p1: '這是一個名為「聖錫亞多姆」的神治國，表面上由神明引導，實則是一個被信仰體制徹底操控的世界，人民從出生便接受【聖痕】的印記，生活在絕對的信仰監控與等級制度下。',
        t_world_p2: '神的意志透過核心裝置「血池」監視民眾，而信仰與貢獻成為衡量生命價值的唯一標準，那些無法服從、或試圖質疑的人，將被標記為【異端】，非死即瘋，最終成為血池的養分或怪物守衛。',
        t_world_p3: '在這片壓抑到近乎絕望的世界中，一位少女的怒火與靈魂成為對抗神明虛偽的火種。',
        
        t_game_title: '實機畫面 (Gameplay)',
        
        t_char_title: '主要角色介紹',
        char_b_name: '貝瑟妮', char_b_title: '- 神之女', char_b_quote: '「既然神不慈悲，那就由我來斬斷這一切。」',
        char_b_desc1: '出身內環區公職家庭。逃亡至偏僻小鎮時，眼睜睜看著雙親為了保護自己而遭騎士團殺害。她在昏迷的夢中感受到靈魂流入，甦醒後傷口癒合、手中的聖痕轉為黑色，並多了一把劍。',
        char_b_desc2: '性格壓抑、不擅言詞，對陌生人有強烈排斥感。但面對敵人時會展現出瘋狂的一面（例如大笑補刀）。雖然世人視她為復仇惡魔，但她的內心仍舊是那名定格於16歲的受傷少女。',
        char_g_name: '加布麗拉', char_g_title: '- 上帝的使者', char_g_quote: '「如果是妳的話，一定能改變這個世界吧？」',
        char_g_desc1: '出生外環區。因擁有讓折斷花朵復原的「治癒」能力，被教會視為魔女。父母試圖藏匿她，卻因恐懼被聖痕感知。',
        char_g_desc2: '鎮長毫不猶豫地舉報了她們一家。加布麗拉在突破騎士團包圍的逃亡路上，偶遇了剛甦醒的貝瑟妮，兩人雖性格迥異（善良無防備 vs 壓抑復仇者），卻在絕望中結下了不解之緣。',

        t_team_title: '開發團隊 (冬山再起工作室)',
        team_lijie: '黃立杰 (隊長)', role_lijie: '企劃 / 關卡 / 玩法',
        team_boquan: '王柏權', role_boquan: '劇本 / 動作設計',
        team_zishen: '李梓燊', role_zishen: '特效 / UI / 程式',
        team_yujun: '陳昱均', role_yujun: '程式 / 數值設計',
        team_borui: '邱柏睿', role_borui: '美術 / 動作設計',
        team_haojun: '潘皓均', role_haojun: '音效 / 程式',

        contrib_title: '個人貢獻 (My Contribution)',
        contrib_role_title: '黃立杰 (隊長 / 企劃 / 關卡)',
        
        contrib_sys_title: '1. 系統架構設計',
        contrib_sys_desc: '負責規劃遊戲整體運作邏輯，確保各系統模組（角色、AI、資料存取）之間的資料流向清晰且易於維護。',
        contrib_sys_cap1: '▲ 遊戲系統架構心智圖：定義了核心玩法與周邊系統的層級關係',
        contrib_sys_cap2: '▲ 遊戲運作邏輯流程圖：展示從啟動到遊玩循環的資料處理流程',

        contrib_lvl_title: '2. 關卡與區域設計',
        contrib_lvl_desc: '設計「第一區域」的完整探索動線。透過線性的劇情引導與非線性的分支探索，平衡敘事節奏與戰鬥體驗。',
        contrib_lvl_cap: '▲ 第一區域完整動線設計草圖：包含教學區(教堂)、劇情區與BOSS戰的空間配置',
        contrib_lvl_li1_t: '動線規劃：', contrib_lvl_li1_d: '設計「回字形」或「分岔」路徑，引導玩家在探索後能回到主幹道。',
        contrib_lvl_li2_t: '隱藏要素：', contrib_lvl_li2_d: '在地圖左下角配置隱藏圖（圖七），獎勵喜歡深入探索的玩家。',

        contrib_pm_title: '3. 專案管理與企劃',
        contrib_pm_li1_t: '🎯 專案管理：', contrib_pm_li1_d: '擔任隊長，負責時程控管、成員工作分配，協調美術與程式技術對接。',
        contrib_pm_li2_t: '⚔️ 戰鬥設計：', contrib_pm_li2_d: '調整主角攻擊手感、判定範圍與敵人 AI 行為模式（靈魂吸收系統）。',
        contrib_pm_li3_t: '📄 世界觀撰寫：', contrib_pm_li3_d: '設定「聖痕」、「血池」等核心概念，並撰寫 NPC 對話文本。'
    },
    'en': {
        menu_title: 'Navigation', menu_about: 'About Me', menu_works: 'Works', menu_thesis: 'Thesis', menu_contact: 'Contact',
        submenu_intro: 'Intro', submenu_world: 'Worldview', submenu_game: 'Gameplay',
        submenu_char: 'Characters', submenu_team: 'Dev Team', submenu_contrib: 'Contribution',
        
        about_title: 'About Me',
        // --- English: Updated to match context (Studying at) ---
        about_intro: 'Hi! I am <strong>Lijie Huang (LJ)</strong>, currently studying at <strong>Lunghwa University of Science and Technology, Dept. of Multimedia & Game Development</strong>.',
        about_desc: 'Positioned as a <strong>Cross-disciplinary Tech Integrator</strong>. I don\'t define myself as a mere programmer, but focus on the practical application of <strong>Generative AI</strong> and <strong>Web 3D</strong>. I excel at researching new technologies and transforming them into interactive projects, possessing the execution ability to quickly materialize abstract concepts.',
        about_hobby: 'Combining <strong>emotional narrative</strong> with <strong>rational logic</strong>. Through cross-disciplinary studies in literature, psychology, and mathematics, I balance the depth of the worldview with the rationality of system mechanics in game design.',
        
        skills_title: 'Skills',
        cat_game: 'Game Design & Core',
        cat_tech: 'Tech Research & AI',
        cat_tools: 'Productivity Tools',
        skill_unreal: 'Unreal Engine',
        skill_narrative: 'Narrative Design & Worldbuilding',
        skill_system: 'System Architecture',
        skill_logic: 'Programming Logic Concepts',
        
        exp_title: 'Experience', 
        date_research: '2023/09 – PRESENT', 
        job_research_title: 'AI Application Research (Personal Project)', 
        job_research_desc: 'Dedicated to researching Generative AI tools and attempting to integrate them into game development workflows and web interactions.',
        
        job_px_title: 'PX Mart - Cashier', 
        job_px_desc: 'Maintained calm and precision in a fast-paced environment, developing strong stress resistance and problem-solving skills.',
        
        job_gas_title: 'King Lung Gas Co. - Financial Assistant', 
        job_gas_desc: 'Assisted with accounting and reports. This experience trained my sensitivity to numbers and patience with detailed tasks.',
        
        edu_title: 'Education', 
        date_lhu: '2022 - 2026 (EXP)', 
        edu_lhu_title: 'Lunghwa University of Science and Technology', 
        edu_lhu_desc: 'Major in Multimedia & Game Development. Served as Team Leader for the senior project, responsible for coordination and planning.',
        
        edu_hs_title: 'Luodong Senior Commercial Vocational School', 
        edu_hs_desc: 'Built a foundation in business and logical thinking.',
        
        project_title: 'Selected Works',
        work_seth_title: 'Seth: AI Virtual Assistant Research', 
        work_seth_desc: 'An experimental project combining Google Gemini API and Web 3D. By integrating LLM, the 3D VRM character gains conversational abilities, exploring the future of web interaction.',
        
        work_dust_desc: 'Team Leader & Planner. Responsible for worldview architecture (based on psychology/sociology), system logic planning, and level design. Coordinated dev and art teams.',
        btn_details: 'View Details',

        contact_title: 'Contact', contact_intro: 'If you are interested in my work, please feel free to contact me:',
        label_name: 'Name', label_phone: 'Phone', label_email: 'Email', label_address: 'Address',
        my_name: 'Lijie Huang (LJ)', my_address: 'Dongshan Township, Yilan County',

        thesis_title: 'Senior Project',
        t_name: '《Dust Soul》',
        t_quote: '"There are no so-called innocent people in this world."',
        t_intro: 'Developed by "Winter Mountain Rising Studio", this is a 2D side-scrolling Metroidvania game. Players play as a girl wielding a black sword, fighting in the rift between life and death until the end of the world.',
        btn_video: 'Trailer', btn_site: 'Project Site', btn_download: '📥 Download Proposal',

        t_world_title: 'Worldview: St. Siyahdom',
        t_world_p1: 'This is a theocracy named "St. Siyahdom". Superficially guided by God, it is actually a world completely manipulated by the faith system. People receive the [Stigmata] mark at birth and live under absolute surveillance.',
        t_world_p2: 'The will of God monitors the people through the core device "Blood Pool". Faith and contribution are the only standards for measuring the value of life. Those who question are marked as [Heretics].',
        t_world_p3: 'In this desperate world, the anger and soul of a girl become the spark to fight against the hypocrisy of the gods.',
        
        t_game_title: 'Gameplay',
        
        t_char_title: 'Characters',
        char_b_name: 'Bethanny', char_b_title: '- Daughter of God', char_b_quote: '"Since God is not merciful, I will sever it all."',
        char_b_desc1: 'Born in the inner circle. She witnessed her parents being killed by the knights to protect her. In her coma, she felt a soul flow in, and woke up with her stigmata turned black and a sword in hand.',
        char_b_desc2: 'She is repressed and hostile to strangers. However, she shows a crazy side when fighting. Although the world sees her as a demon of revenge, inside she is still that injured 16-year-old girl.',
        char_g_name: 'Gebriea', char_g_title: '- Messenger of God', char_g_quote: '"If it were you, you could definitely change this world, right?"',
        char_g_desc1: 'Born in the outer circle. Regarded as a witch because of her "Healing" ability. Her parents tried to hide her, but were exposed by the stigmata.',
        char_g_desc2: 'The mayor reported her family without hesitation. While fleeing the knights, she met the newly awakened Bethanny. Though they are different, they formed an inseparable bond in despair.',

        t_team_title: 'Dev Team (Winter Mountain Rising)',
        team_lijie: 'Lijie Huang (Leader)', role_lijie: 'Planning / Level / Gameplay',
        team_boquan: 'Boquan Wang', role_boquan: 'Script / Motion',
        team_zishen: 'Zishen Li', role_zishen: 'VFX / UI / Code',
        team_yujun: 'Yujun Chen', role_yujun: 'Code / Numerical',
        team_borui: 'Borui Qiu', role_borui: 'Art / Motion',
        team_haojun: 'Haojun Pan', role_haojun: 'Sound / Code',

        contrib_title: 'My Contribution',
        contrib_role_title: 'Lijie Huang (Leader / Planning / Level)',
        
        contrib_sys_title: '1. System Architecture',
        contrib_sys_desc: 'Planned the overall game logic, ensuring clear data flow and maintainability between system modules (Character, AI, Data Access).',
        contrib_sys_cap1: '▲ System Architecture Mindmap: Defining core gameplay and system hierarchy.',
        contrib_sys_cap2: '▲ Game Logic Flowchart: Showing data processing from startup to gameplay loop.',

        contrib_lvl_title: '2. Level & Area Design',
        contrib_lvl_desc: 'Designed the complete exploration route for the "First Area". Balanced narrative and combat through linear storytelling and branching exploration.',
        contrib_lvl_cap: '▲ First Area Layout: Including Tutorial (Church), Story Area, and Boss Fight.',
        contrib_lvl_li1_t: 'Route Planning:', contrib_lvl_li1_d: 'Designed "Loop" or "Fork" paths to guide players back to the main road after exploration.',
        contrib_lvl_li2_t: 'Hidden Elements:', contrib_lvl_li2_d: 'Placed a hidden map (Map 7) in the lower left to reward explorers.',

        contrib_pm_title: '3. Management & Planning',
        contrib_pm_li1_t: '🎯 Project Management:', contrib_pm_li1_d: 'As the leader, I managed the schedule, assigned tasks, and coordinated between Art and Programming.',
        contrib_pm_li2_t: '⚔️ Combat Design:', contrib_pm_li2_d: 'Adjusted attack feel, hitboxes, and enemy AI behavior (Soul Absorption System).',
        contrib_pm_li3_t: '📄 Worldview Writing:', contrib_pm_li3_d: 'Defined core concepts like "Stigmata" and "Blood Pool", and wrote NPC dialogue.'
    },
    'jp': {
        menu_title: 'メニュー', menu_about: '自己紹介', menu_works: '作品', menu_thesis: '卒業制作', menu_contact: 'お問い合わせ',
        submenu_intro: '紹介', submenu_world: '世界観', submenu_game: 'プレイ画面',
        submenu_char: 'キャラクター', submenu_team: '開発チーム', submenu_contrib: '個人の貢献',
        
        about_title: '私について',
        // --- JP: Updated to match context (Currently studying at) ---
        about_intro: 'こんにちは！<strong>黃 立杰 (LJ)</strong>です。現在、<strong>龍華科技大学 マルチメディア・ゲーム開発科学科</strong>に在籍しています。',
        about_desc: '<strong>領域横断的な技術インテグレーター</strong>として活動しています。単なるプログラマーではなく、<strong>生成AI</strong>と<strong>Web 3D</strong>の実装・応用に注力しています。新技術を研究し、それを実際のインタラクティブなプロジェクトに転換することを得意とし、抽象的な概念を素早く具現化する実行力を持っています。',
        about_hobby: '<strong>感性的なナラティブ</strong>と<strong>理性的なロジック</strong>を兼ね備えています。文学、心理学、数学といった多分野への探求心により、ゲーム企画やシステム設計において、世界観の深みとメカニクスの合理性を両立させています。',
        
        skills_title: '専門スキル',
        cat_game: 'ゲーム企画 & コア能力',
        cat_tech: '技術研究 & AI応用',
        cat_tools: '生産性ツール',
        skill_unreal: 'Unreal Engine',
        skill_narrative: 'ナラティブデザイン & 世界観',
        skill_system: 'システム設計',
        skill_logic: 'プログラミング論理概念',
        
        exp_title: '経歴', 
        date_research: '2023/09 – 現在', 
        job_research_title: 'AI技術応用研究 (個人プロジェクト)', 
        job_research_desc: '生成AIツールの使用法を研究し、それをゲーム開発プロセスやWebインタラクションに導入するための技術再現とテストを行っています。',
        
        job_px_title: '全聯福利中心 - レジ係', 
        job_px_desc: 'ペースの速い環境で冷静さと正確さを保ち、ストレス耐性と即時の問題解決能力を養いました。',
        
        job_gas_title: '金龍ガス株式会社 - 財務／会計アシスタント', 
        job_gas_desc: '会計やレポート作成を補助。数字への感度と、細かい事務作業に対する忍耐力を身につけました。',
        
        edu_title: '学歴', 
        date_lhu: '2022 - 2026 (卒業予定)', 
        edu_lhu_title: '龍華科技大学 - 多メディア・ゲーム開発科学系', 
        edu_lhu_desc: '専攻はマルチメディアとゲーム開発。卒業制作ではチームリーダーを務め、統括と企画を担当しました。',
        
        edu_hs_title: '羅東高級商業職業学校 - 商業経営科', 
        edu_hs_desc: 'ビジネスの基礎と論理的思考を確立しました。',
        
        project_title: '代表作品',
        work_seth_title: 'Seth: AI 仮想アシスタント研究', 
        work_seth_desc: 'Google Gemini APIとWeb 3D技術を組み合わせた実験的プロジェクト。大規模言語モデルを統合することで、3D VRMキャラクターに会話能力を持たせ、Webインタラクションの未来を探求しています。',
        
        work_dust_desc: 'リーダー兼企画を担当。心理学や社会学の概念に基づいた世界観の構築、システムロジックの設計、レベルデザインを担当。プログラムとアートチームを調整し、プロジェクトの遂行を確実にしました。',
        btn_details: '詳細を見る',

        contact_title: 'お問い合わせ', contact_intro: '私の作品に興味をお持ちの方は、以下の方法でご連絡ください：',
        label_name: '氏名', label_phone: '電話番号', label_email: 'メール', label_address: '住所',
        my_name: '黃 立杰 (LJ)', my_address: '台湾 宜蘭県 冬山郷',

        thesis_title: '卒業制作 (Senior Project)',
        t_name: '《Dust Soul (塵世の魂)》',
        t_quote: '「この世に無実の人間など存在しない。」',
        t_intro: '「冬山再起スタジオ」によって開発された、2D横スクロールのメトロイドヴァニアゲームです。プレイヤーは黒い剣を持つ少女となり、生と死の狭間で世界が終わるまで戦います。',
        btn_video: '予告編', btn_site: 'プロジェクトサイト', btn_download: '📥 企画書をDL',

        t_world_title: '世界観：聖シアドム',
        t_world_p1: 'ここは「聖シアドム」と呼ばれる神治国家です。表向きは神に導かれていますが、実際は信仰システムによって完全に支配された世界です。人々は生まれながらに【聖痕】を受け、完全な監視下で生活しています。',
        t_world_p2: '神の意志はコアデバイス「血の池」を通じて民衆を監視し、信仰と貢献だけが生命の価値を測る基準となります。疑念を抱く者は【異端】とされ、処分されるか怪物の衛兵となります。',
        t_world_p3: 'この絶望的な世界で、ある少女の怒りと魂が、神々の偽善に対抗する火種となります。',
        
        t_game_title: 'ゲームプレイ画面',
        
        t_char_title: '主要キャラクター',
        char_b_name: 'ベサニー', char_b_title: '- 神の娘', char_b_quote: '「神が慈悲深くないのなら、私がすべてを断ち切る。」',
        char_b_desc1: '内環区の公務員の家庭に生まれる。逃亡中に両親が騎士団に殺害されるのを目の当たりにし、昏睡状態の中で魂が流れ込むのを感じる。目覚めると聖痕は黒く変わり、手には剣があった。',
        char_b_desc2: '抑圧的で他人を拒絶する性格。しかし戦闘時には狂気的な一面を見せる。世間からは復讐の悪魔と見なされているが、内心は傷ついた16歳の少女のままである。',
        char_g_name: 'ガブリエラ', char_g_title: '- 神の使者', char_g_quote: '「あなたなら、きっとこの世界を変えられるでしょう？」',
        char_g_desc1: '外環区出身。折れた花を治す「治癒」能力を持っていたため、魔女と見なされた。両親は彼女を隠そうとしたが、聖痕によって露見した。',
        char_g_desc2: '町長は迷わず彼女の一家を通報した。逃亡中に目覚めたばかりのベサニーと出会う。性格は正反対だが、絶望の中で二人は固い絆で結ばれた。',

        t_team_title: '開発チーム (冬山再起スタジオ)',
        team_lijie: '黃 立杰 (リーダー)', role_lijie: '企画 / レベル / ゲームプレイ',
        team_boquan: '王 柏權', role_boquan: '脚本 / モーション',
        team_zishen: '李 梓燊', role_zishen: 'VFX / UI / プログラム',
        team_yujun: '陳 昱均', role_yujun: 'プログラム / 数値設計',
        team_borui: '邱 柏睿', role_borui: 'アート / モーション',
        team_haojun: '潘 皓均', role_haojun: 'サウンド / プログラム',

        contrib_title: '個人の貢献 (My Contribution)',
        contrib_role_title: '黃 立杰 (リーダー / 企画 / レベル設計)',
        
        contrib_sys_title: '1. システムアーキテクチャ設計',
        contrib_sys_desc: 'ゲーム全体の動作ロジックを計画し、各システムモジュール（キャラクター、AI、データアクセス）間のデータフローを明確かつ保守しやすくしました。',
        contrib_sys_cap1: '▲ システム構成マインドマップ：コアゲームプレイとシステム階層の定義。',
        contrib_sys_cap2: '▲ ロジックフローチャート：起動からゲームループまでのデータ処理。',

        contrib_lvl_title: '2. レベル＆エリア設計',
        contrib_lvl_desc: '「第一エリア」の完全な探索ルートを設計しました。リニアなストーリー誘導とノンリニアな分岐探索を通じて、物語のペースと戦闘体験のバランスを取りました。',
        contrib_lvl_cap: '▲ 第一エリア設計図：チュートリアル（教会）、ストーリーエリア、ボス戦を含む。',
        contrib_lvl_li1_t: '動線計画：', contrib_lvl_li1_d: '探索後にメインルートに戻れるよう、「ループ」や「分岐」パスを設計しました。',
        contrib_lvl_li2_t: '隠し要素：', contrib_lvl_li2_d: '探索好きのプレイヤーへの報酬として、マップ左下に隠しマップ（図7）を配置しました。',

        contrib_pm_title: '3. プロジェクト管理と企画',
        contrib_pm_li1_t: '🎯 プロジェクト管理：', contrib_pm_li1_d: 'リーダーとしてスケジュール管理、タスク割り当て、アートとプログラムの連携を行いました。',
        contrib_pm_li2_t: '⚔️ 戦闘デザイン：', contrib_pm_li2_d: '主人公の攻撃感覚、判定範囲、敵AIの行動パターン（ソウル吸収システム）を調整しました。',
        contrib_pm_li3_t: '📄 世界観作成：', contrib_pm_li3_d: '「聖痕」「血の池」などの核心概念を設定し、NPCの対話テキストを執筆しました。'
    }
};
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[lang]?.[key]) el.innerHTML = translations[lang][key];
    });
    document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active'); 
};

switchSection('about');
// ... (檔案最下方) ...

switchSection('about');

// ▼ 補上這一段：手機版選單控制功能 ▼
window.toggleSidebar = function() {
    const sidebar = document.querySelector('.sidebar');
    const btn = document.getElementById('mobile-menu-btn');
    const body = document.body;
    
    // 切換選單顯示狀態
    sidebar.classList.toggle('active');
    
    // 切換按鈕圖示 (☰ 變 ✕)
    if (sidebar.classList.contains('active')) {
        btn.innerHTML = '✕';
        // 選擇性：打開選單時禁止背景滾動
        // body.style.overflow = 'hidden'; 
    } else {
        btn.innerHTML = '☰';
        // body.style.overflow = '';
    }
};

// 點擊連結後自動收起選單 (優化手機體驗)
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.side-nav a').forEach(link => {
        link.addEventListener('click', () => {
            // 只有在手機版 (螢幕 < 768px) 才執行自動收起
            if (window.innerWidth <= 768) {
                const sidebar = document.querySelector('.sidebar');
                const btn = document.getElementById('mobile-menu-btn');
                
                sidebar.classList.remove('active');
                btn.innerHTML = '☰';
            }
        });
    });
});