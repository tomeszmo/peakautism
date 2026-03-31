/**
 * PEAK AUTISM - Végleges, Stabilizált Verzió
 * Fix: Snapping-mentes átmenet és késleltetett egérmozgás
 */

// --- 1. ELEMEK ---
const titleEl = document.getElementById('topic-title');
const summaryEl = document.getElementById('summary-text');
const linkEl = document.getElementById('source-link');
const btn = document.getElementById('new-topic-btn');
const card = document.getElementById('main-card');
const imageEl = document.getElementById('topic-image');
const imageContainer = document.getElementById('card-image-container');
const clickSound = document.getElementById('click-sound');
const skeletonLoader = document.getElementById('skeleton-loader');
const realContent = document.getElementById('real-content');

let isDealing = false; 
let isLocked = true; // ÚJ: Blokkolja a mozgást az animáció végéig + 0.5mp
let curX = 0, curY = 0; 
let tgtX = 0, tgtY = 0; 
const lerpFactor = 0.08; 

// --- 2. HANGKEZELÉS ---
function playClickSound() {
    if (clickSound) {
        clickSound.pause();
        clickSound.currentTime = 0;
        clickSound.volume = 0.4;
        clickSound.play().catch(() => {});
    }
}

// --- 3. FORDÍTÓ ---
async function translateToHungarian(text) {
    if (!text || text.length < 2) return text;
    try {
        const cleanText = text.replace(/_/g, ' ').trim();
        const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanText)}&langpair=en|hu`);
        const data = await res.json();
        return data.responseStatus === 200 ? data.responseData.translatedText : cleanText;
    } catch (error) { 
        return text; 
    }
}

// --- 4. FŐ FUNKCIÓ ---
async function getNewTopic() {
    requestDeviceOrientation(); 
    playClickSound();
    
    btn.disabled = true;
    btn.innerText = "KERESÉS...";

    // --- 1. RESET ÉS ELŐKÉSZÜLET ---
    isDealing = true; 
    isLocked = true;
    tgtX = 0; tgtY = 0; 
    
    card.style.opacity = "0";
    card.classList.remove('card-dealing');

    const contentBox = card.querySelector('.card-content');
    if (contentBox) {
        contentBox.style.overflowY = "hidden";
        contentBox.scrollTop = 0;
    }

    // Tisztítás: régi adatok ki, loader be
    titleEl.innerText = "";
    summaryEl.innerText = "";
    imageEl.src = "";
    imageContainer.classList.add('hidden');
    realContent.classList.add('hidden');
    skeletonLoader.classList.remove('hidden');

    try {
        // --- 2. ADATOK LEKÉRÉSE ---
        const response = await fetch('https://en.wikipedia.org/api/rest_v1/page/random/summary');
        const data = await response.json();
        
        const [tTitle, tSum] = await Promise.all([
            translateToHungarian(data.title),
            translateToHungarian(data.extract)
        ]);

        // Adatok beírása a háttérben (még nem látszik)
        titleEl.innerText = tTitle || data.title;
        summaryEl.innerText = tSum || data.extract;
        linkEl.href = data.content_urls.desktop.page;

        if (data.originalimage) {
            imageEl.src = data.originalimage.source;
            imageContainer.classList.remove('hidden');
        } else {
            imageContainer.classList.add('hidden');
        }

        // --- 3. A KÉRT 1 MÁSODPERCES EXTRA VÁRAKOZÁS ---
        // Megvárjuk, amíg a böngésző "megemészti" az új képet és szöveget
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Görgetés kényszerített nullázása a megjelenés előtt
        if (contentBox) contentBox.scrollTop = 0;

        // --- 4. ANIMÁCIÓ INDÍTÁSA (Most már a kész tartalommal) ---
        skeletonLoader.classList.add('hidden');
        realContent.classList.remove('hidden');
        
        card.classList.add('card-dealing');
        card.style.opacity = "1";
        
        setTimeout(() => {
            card.classList.remove('card-dealing');
            isDealing = false; 

            // Utolsó fél másodperces zárlat a mozgás előtt
            setTimeout(() => {
                isLocked = false; 
                card.style.pointerEvents = "auto";
                if (contentBox) contentBox.style.overflowY = "auto";
                btn.disabled = false;
                btn.innerText = "NEXT TOPIC";
            }, 500);

        }, 700);

    } catch (err) {
        btn.disabled = false;
        btn.innerText = "HIBA - ÚJRA";
        isDealing = false;
        isLocked = false;
        card.style.opacity = "1";
        skeletonLoader.classList.add('hidden');
        realContent.classList.remove('hidden');
    }
}

// --- 5. MOZGÁS ---
window.addEventListener('mousemove', (e) => {
    // Ha zárolva van az animáció miatt, nem frissítjük a célt
    if (window.innerWidth < 768 || isLocked) return;
    
    const rect = card.getBoundingClientRect();
    const x = e.clientX - (rect.left + rect.width / 2);
    const y = e.clientY - (rect.top + rect.height / 2);
    
    tgtX = (-y / (window.innerHeight / 2)) * 10;
    tgtY = (x / (window.innerWidth / 2)) * 10;
});

window.addEventListener('mouseleave', () => {
    tgtX = 0; tgtY = 0;
});

function handleOrientation(event) {
    if (window.innerWidth >= 768 || isLocked) return;
    const beta = event.beta;   
    const gamma = event.gamma; 
    tgtX = Math.max(Math.min((beta - 45) / 1.5, 10), -10);
    tgtY = Math.max(Math.min(gamma / 1.5, 10), -10);
}

function updateMotion() {
    // Ha le van zárva, a célpontot kényszerítjük 0-ra
    if (isLocked) {
        tgtX = 0;
        tgtY = 0;
    }

    curX += (tgtX - curX) * lerpFactor;
    curY += (tgtY - curY) * lerpFactor;
    
    // Csak akkor dőljön, ha a CSS animáció (beúszás) már nem fut
    if (card && !isDealing) {
        card.style.transform = `rotateX(${curX}deg) rotateY(${curY}deg)`;
    }
    requestAnimationFrame(updateMotion);
}
updateMotion();

function requestDeviceOrientation() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission().then(res => {
            if (res === 'granted') window.addEventListener('deviceorientation', handleOrientation);
        });
    } else {
        window.addEventListener('deviceorientation', handleOrientation);
    }
}

btn.addEventListener('click', getNewTopic);
window.addEventListener('load', () => setTimeout(getNewTopic, 300));