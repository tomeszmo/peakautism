// --- 1. GLOBÁLIS VÁLTOZÓK ---
let topicCount = 0; 
let lerpFactor = 0.05; 
let isDealing = false; 
let isLocked = true; 
let curX = 0; let curY = 0;
let tgtX = 0; let tgtY = 0;
let isDragging = false;
let startX = 0;
let currentTranslateX = 0;
let currentCardData = null;

let isHungarian = true; // Alapértelmezetten magyarul tölt be
let motionEnabled = false; // Alapból ki van kapcsolva a mozgás, amíg nem kérik

// --- 2. ELEMEK LEKÉRÉSE ---
const titleEl = document.getElementById('topic-title');
const summaryEl = document.getElementById('summary-text');
const linkEl = document.getElementById('source-link');
const card = document.getElementById('main-card');
const imageEl = document.getElementById('topic-image');
const imageContainer = document.getElementById('card-image-container');
const skeletonLoader = document.getElementById('skeleton-loader');
const realContent = document.getElementById('real-content');
const countEl = document.getElementById('topic-count');
const counterBadge = document.getElementById('session-counter');

// --- 3. SEGÉDFÜGGVÉNYEK ---
function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = url;
        img.onload = () => resolve(url);
        img.onerror = () => reject(new Error("Kép hiba"));
    });
}

async function translateToHungarian(text) {
    if (!text || text.length < 2) return text;
    try {
        const cleanText = text.replace(/_/g, ' ').trim();
        const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanText)}&langpair=en|hu`);
        const data = await res.json();
        return data.responseStatus === 200 ? data.responseData.translatedText : cleanText;
    } catch (error) { return text; }
}

// --- DEEP DIVE FUNKCIÓ (ÚJ) ---
async function getRelatedTopics(event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    const btn = document.getElementById('deep-dive-btn');
    const container = document.getElementById('related-container');
    const list = document.getElementById('related-list');
    const titleText = titleEl ? titleEl.innerText : "";

    if (!titleText || btn.disabled) return;

    btn.innerHTML = "<span>⏳</span> SEARCHING...";
    btn.disabled = true;

    try {
        const searchTerm = encodeURIComponent(titleText);
        const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${searchTerm}&format=json&origin=*&srlimit=3`;

        const response = await fetch(url);
        const data = await response.json();

        if (!data.query || data.query.search.length === 0) {
            btn.innerHTML = "<span>🔍</span> NINCS TALÁLAT";
            setTimeout(() => { btn.disabled = false; btn.innerHTML = "<span>🔍</span> DEEP DIVE (Beta Testing)"; }, 2000);
            return;
        }

        list.innerHTML = "";
        const results = data.query.search;

        for (let res of results) {
            let rTitle = res.title;
            let rSummary = res.snippet.replace(/(<([^>]+)>)/gi, "") + "...";

            if (window.isHungarian && typeof translateToHungarian === 'function') {
                try {
                    const [tT, tS] = await Promise.all([
                        translateToHungarian(rTitle),
                        translateToHungarian(rSummary)
                    ]);
                    rTitle = tT;
                    rSummary = tS;
                } catch (e) { console.warn("Hiba a Deep Dive fordításakor."); }
            }

            const item = document.createElement('div');
            item.className = 'related-item';
            item.innerHTML = `<h4>${rTitle}</h4><p>${rSummary}</p>`;
            list.appendChild(item);
        }

        container.classList.remove('hidden');
        btn.classList.add('hidden');

    } catch (err) {
        console.error("Deep Dive hiba:", err);
        btn.innerHTML = "<span>❌</span> HIBA";
        btn.disabled = false;
    }
}

// --- 4. A FŐ FUNKCIÓ ---
async function getNewTopic() {
    if (typeof motionEnabled !== 'undefined' && !motionEnabled && typeof DeviceOrientationEvent !== 'undefined') {
        if (typeof requestMotionPermission === 'function') requestMotionPermission();
    }
    
    if (isDealing) return;
    isDealing = true;
    isLocked = true; 
    
    if (card) {
        card.style.opacity = "1";
        card.style.transform = "translateX(0) rotate(0deg) scale(1)";
        card.classList.remove('hidden'); 
    }

    if (skeletonLoader) skeletonLoader.classList.remove('hidden');
    if (realContent) realContent.classList.add('hidden');
    if (imageContainer) imageContainer.classList.add('hidden');
    
    // Deep Dive Reset
    const ddBtn = document.getElementById('deep-dive-btn');
    const ddCont = document.getElementById('related-container');
    if (ddBtn && ddCont) {
        ddBtn.classList.remove('hidden');
        ddBtn.innerHTML = "<span>🔍</span> DEEP DIVE (Beta Testing)";
        ddBtn.disabled = false;
        ddCont.classList.add('hidden');
    }
    
    const contentBox = document.querySelector('.card-content');
    if (contentBox) {
        contentBox.scrollTop = 0;
        contentBox.style.overflowY = "hidden";
    }

    const startTime = Date.now();

    try {
        const response = await fetch('https://en.wikipedia.org/api/rest_v1/page/random/summary');
        const data = await response.json();

        currentCardData = data;

        let tTitle = data.title;
        let tSum = data.extract;
        
        if (window.isHungarian && typeof translateToHungarian === 'function') {
            try {
                const [translatedTitle, translatedSum] = await Promise.all([
                    translateToHungarian(data.title),
                    translateToHungarian(data.extract)
                ]);
                tTitle = translatedTitle;
                tSum = translatedSum;
            } catch (e) { console.warn("Fordítás sikertelen, marad az angol."); }
        }

        if (data.originalimage && typeof loadImage === 'function') {
            await loadImage(data.originalimage.source);
        }

        topicCount++; 
        const counterEl = document.getElementById('topic-count'); 
        if (counterEl) {
            counterEl.innerText = topicCount;
        }

        const elapsed = Date.now() - startTime;
        if (elapsed < 1000) await new Promise(r => setTimeout(r, 1000 - elapsed));

        if (titleEl) titleEl.innerText = tTitle;
        if (summaryEl) summaryEl.innerText = tSum;
        if (linkEl) linkEl.href = data.content_urls.desktop.page;
        
        if (imageEl && data.originalimage) {
            imageEl.src = data.originalimage.source;
            if (imageContainer) imageContainer.classList.remove('hidden');
        }

        if (typeof updateBlobColors === 'function') updateBlobColors();

        if (skeletonLoader) skeletonLoader.classList.add('hidden');
        if (realContent) realContent.classList.remove('hidden');
        
        if (contentBox) {
            contentBox.scrollTop = 0;
            requestAnimationFrame(() => {
                contentBox.scrollTo({ top: 0, behavior: 'instant' });
                contentBox.scrollTop = 0;
                contentBox.style.overflowY = "auto";
            });
        }

        if (card) {
            card.classList.add('card-dealing');
            setTimeout(() => {
                card.classList.remove('card-dealing');
                isDealing = false;
                isLocked = false; 

                if (typeof lerpFactor !== 'undefined') lerpFactor = 0.001; 
                let accel = setInterval(() => {
                    if (lerpFactor < 0.06) lerpFactor += 0.005;
                    else clearInterval(accel);
                }, 100);
            }, 800);
        }

    } catch (err) {
        console.error("Hiba:", err);
        isDealing = false;
        isLocked = false;
        if (skeletonLoader) skeletonLoader.classList.add('hidden');
        if (realContent) realContent.classList.remove('hidden');
    }
}

// --- 5. MOZGÁS ÉS SWIPE ---
function updateMotion() {
    if (isLocked || isDragging) {
        tgtX = 0; tgtY = 0;
    }

    curX += (tgtX - curX) * lerpFactor;
    curY += (tgtY - curY) * lerpFactor;

    if (card && !isDealing && !isDragging) {
        card.style.transform = `rotateX(${curX}deg) rotateY(${curY}deg)`;
    }

    const img = document.getElementById('topic-image');
    if (img && !isDealing && !isDragging) {
        img.style.transform = `translateZ(40px)`;
    }

    document.querySelectorAll('.blob').forEach((blob, index) => {
        const intensity = (index + 1) * 12; 
        blob.style.transform = `translate(${-curY * intensity}px, ${curX * intensity}px)`;
    });

    requestAnimationFrame(updateMotion);
}

window.addEventListener('mousemove', (e) => {
    if (window.innerWidth < 768 || isLocked || isDragging) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - (rect.left + rect.width / 2);
    const y = e.clientY - (rect.top + rect.height / 2);
    tgtX = (-y / (window.innerHeight / 2)) * 10;
    tgtY = (x / (window.innerWidth / 2)) * 10;
});

const dragStart = (e) => {
    if (isDealing) return;
    isDragging = true;
    startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
};

const dragMove = (e) => {
    if (!isDragging || isDealing) return;
    const x = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    currentTranslateX = x - startX;
    const rot = currentTranslateX / 10;
    card.style.transform = `translateX(${currentTranslateX}px) rotate(${rot}deg)`;
    card.style.opacity = 1 - Math.abs(currentTranslateX) / 600;
};

const dragEnd = () => {
    if (!isDragging) return;
    isDragging = false;

    if (Math.abs(currentTranslateX) < 5) {
        resetPos();
        return; 
    }

    if (Math.abs(currentTranslateX) > 120) {
        card.style.opacity = '0';
        setTimeout(() => { 
            getNewTopic(); 
            resetPos(); 
        }, 200);
    } else { 
        resetPos(); 
    }
    currentTranslateX = 0;
};

function resetPos() {
    card.style.transition = '0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    card.style.transform = 'translateX(0) rotate(0deg)';
    card.style.opacity = '1';
    setTimeout(() => card.style.transition = '', 500);
}

card.addEventListener('mousedown', dragStart);
window.addEventListener('mousemove', dragMove);
window.addEventListener('mouseup', dragEnd);
card.addEventListener('touchstart', dragStart);
window.addEventListener('touchmove', dragMove);
window.addEventListener('touchend', dragEnd);

function handleOrientation(event) {
    if (window.innerWidth >= 768 || isLocked || isDragging) return;
    tgtX = Math.max(Math.min((event.beta - 45) / 1.5, 12), -12);
    tgtY = Math.max(Math.min(event.gamma / 1.5, 12), -12);
}

function requestMotionPermission() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(response => {
                if (response === 'granted') {
                    window.addEventListener('deviceorientation', handleOrientation);
                }
            })
            .catch(console.error);
    } else {
        window.addEventListener('deviceorientation', handleOrientation);
    }
}

async function enableMotion() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
            const response = await DeviceOrientationEvent.requestPermission();
            if (response === 'granted') {
                motionEnabled = true;
                window.addEventListener('deviceorientation', handleOrientation);
                alert("Szenzorok aktiválva!");
            }
        } catch (err) { console.error(err); }
    } else {
        motionEnabled = true;
        window.addEventListener('deviceorientation', handleOrientation);
        alert("Mozgás bekapcsolva!");
    }
    const overlay = document.getElementById('motion-overlay');
    if (overlay) overlay.style.display = 'none';
}

async function toggleLanguage() {
    const checkbox = document.getElementById('lang-toggle');
    window.isHungarian = checkbox.checked;
    if (!currentCardData) return;

    if (window.isHungarian) {
        try {
            const tTitle = await translateToHungarian(currentCardData.title);
            const tSum = await translateToHungarian(currentCardData.extract);
            if (titleEl) titleEl.innerText = tTitle;
            if (summaryEl) summaryEl.innerText = tSum;
        } catch (e) { console.error(e); }
    } else {
        if (titleEl) titleEl.innerText = currentCardData.title;
        if (summaryEl) summaryEl.innerText = currentCardData.extract;
    }
}

function updateBlobColors() {
    const colors = [
        'rgba(255, 99, 132, 0.4)', 'rgba(54, 162, 235, 0.4)', 
        'rgba(255, 206, 86, 0.4)', 'rgba(75, 192, 192, 0.4)', 
        'rgba(153, 102, 255, 0.4)', 'rgba(255, 159, 64, 0.4)'
    ];
    document.querySelectorAll('.blob').forEach(blob => {
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        blob.style.backgroundColor = randomColor;
    });
}

document.addEventListener("DOMContentLoaded", () => {
    updateMotion();
    getNewTopic();
});