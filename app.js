/**
 * PEAK AUTISM - Végleges, Stabilizált Verzió
 * Funkciók: 3D kártyamozgás, 1mp Skeleton várakozás, Azonnali gomb-reaktiválás
 */

let currentLerp = 0.02; // Kezdeti nagyon lassú követés
const targetLerp = 0.08; // A végleges, reszponzív sebesség

// Segédfüggvény: megvárja, amíg egy kép ténylegesen letöltődik
function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = url;
        img.onload = () => resolve(url);
        img.onerror = () => reject(new Error("Kép betöltési hiba"));
    });
}

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
let isLocked = true; // Blokkolja a mozgást az animáció végéig
let curX = 0;
let curY = 0;
let tgtX = 0;
let tgtY = 0;
let lerpFactor = 0.05; // Finom követés

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

    const stack = document.querySelector('.card-stack');
    if (stack) stack.classList.add('stack-active');
    
    // 1. GOMB ÉS ÁLLAPOT RESET
    btn.disabled = true;
    const loadingTexts = ["SEARCHING...", "DEALING CARDS...", "PEAKING..."];
    btn.innerText = loadingTexts[Math.floor(Math.random() * loadingTexts.length)];
    isDealing = true; 
    isLocked = true;
    
    // 2. RÉGI TARTALOM AZONNALI TÖRLÉSE
    titleEl.innerText = "";
    summaryEl.innerText = "";
    imageEl.src = "";
    imageContainer.classList.add('hidden');
    
    // 3. KÁRTYA ÉS GÖRDÍTÉS ELŐKÉSZÍTÉSE
    card.classList.remove('card-dealing');
    card.style.opacity = "1"; 
    
    const contentBox = card.querySelector('.card-content');
    if (contentBox) {
        contentBox.style.overflowY = "hidden";
        contentBox.scrollTop = 0; // Első fázisú nullázás
    }
    
    skeletonLoader.classList.remove('hidden');
    realContent.classList.add('hidden');

    try {
        // 4. ADATOK LEKÉRÉSE ÉS FORDÍTÁS
        const response = await fetch('https://en.wikipedia.org/api/rest_v1/page/random/summary');
        const data = await response.json();
        
        const translationPromise = Promise.all([
            translateToHungarian(data.title),
            translateToHungarian(data.extract)
        ]);

        // 5. KÉP ELŐTÖLTÉSE (Ha van)
        let imagePromise = Promise.resolve();
        if (data.originalimage) {
            imagePromise = loadImage(data.originalimage.source);
        }

        // 6. MEGVÁRJUK A TELJES BETÖLTÉST (Fordítás + Kép)
        const [translations] = await Promise.all([translationPromise, imagePromise]);
        const [tTitle, tSum] = translations;

        // 7. ADATOK BEÍRÁSA
        titleEl.innerText = tTitle || data.title;
        summaryEl.innerText = tSum || data.extract;
        linkEl.href = data.content_urls.desktop.page;

        if (data.originalimage) {
            imageEl.src = data.originalimage.source;
            imageContainer.classList.remove('hidden');
        } else {
            imageContainer.classList.add('hidden');
        }

        // A getNewTopic-ban, ahol a címet és képet állítod be:
const randomHue = Math.floor(Math.random() * 360); // Generálunk egy véletlen színt
document.querySelectorAll('.blob').forEach(blob => {
    // A színeket a HSL skálán mozgatjuk a lágyabb hatásért
    blob.style.background = `hsla(${randomHue}, 70%, 50%, 0.6)`;
});

        // --- KRITIKUS PONT: GÖRDÍTÉS ÚJRA KÉNYSZERÍTÉSE ---
        if (contentBox) {
            contentBox.scrollTop = 0; // Második fázisú nullázás a tartalom betöltése után
        }

        // 8. VÁLTÁS ÉS MEGJELENÍTÉS
        skeletonLoader.classList.add('hidden'); 
        realContent.classList.remove('hidden'); 
        
        // Egy extra nullázás, miután a 'hidden' lekerült (biztos ami biztos)
        if (contentBox) contentBox.scrollTop = 0;

        card.classList.add('card-dealing'); 

        // 9. REAKTIVÁLÁS
        btn.disabled = false;
        btn.innerText = "NEXT TOPIC";

       setTimeout(() => {
    card.classList.remove('card-dealing');
    isDealing = false;

    // Itt a trükk: Előbb feloldjuk a zárat, de a lerpFactor-t 
    // nagyon kicsire vesszük, hogy lassan "ússzon be" a helyére
    lerpFactor = 0.001; 
    isLocked = false;

    // 1 másodperc alatt fokozatosan gyorsítjuk fel a követést
    let speedUp = setInterval(() => {
        if (lerpFactor < 0.08) {
            lerpFactor += 0.005;
        } else {
            clearInterval(speedUp);
        }
    }, 50);

    if (contentBox) contentBox.style.overflowY = "auto";
}, 800);

    } catch (err) {
        console.error(err);
        btn.disabled = false;
        btn.innerText = "TRY AGAIN";
        skeletonLoader.classList.add('hidden');
    }
}

// --- 5. MOZGÁS KEZELÉSE ---
window.addEventListener('mousemove', (e) => {
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

// --- JAVÍTOTT updateMotion() – 3D VASTAGSÁG HATÁSSAL A KÉPEN ---
function updateMotion() {
    if (isLocked) {
        tgtX = 0;
        tgtY = 0;
    }

    curX += (tgtX - curX) * lerpFactor;
    curY += (tgtY - curY) * lerpFactor;

    // --- KÁRTYA MOZGATÁSA (Már megvan) ---
    const img = document.getElementById('topic-image');
    if (img && !isDealing) {
        img.style.transform = `rotateX(${curX}deg) rotateY(${curY}deg) translateZ(35px)`;
        // ... árnyék kódod ...
    }

    if (card && !isDealing) {
        card.style.transform = `rotateX(${curX}deg) rotateY(${curY}deg)`;
    }

    // --- ÚJ: HÁTTÉR BUBORÉKOK DINAMIKUS MOZGATÁSA ---
    const blobs = document.querySelectorAll('.blob');
    blobs.forEach((blob, index) => {
        // Minden blob kicsit más intenzitással reagál (parallax mélység)
        const intensity = (index + 1) * 15; 
        
        // Ellentétes irányú mozgás: ha jobbra döntöd, a háttér balra úszik
        const moveX = -curY * intensity; 
        const moveY = curX * intensity;
        
        // Alkalmazzuk a mozgást (megtartva az eredeti lebegést, ha van)
        blob.style.transform = `translate(${moveX}px, ${moveY}px) scale(${1 + (curX/100)})`;
    });

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

// --- 6. DINAMIKUS SCROLLBAR ---
const contentBox = card.querySelector('.card-content');
let scrollTimer = null;

if (contentBox) {
    contentBox.addEventListener('scroll', () => {
        contentBox.classList.add('is-scrolling');
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
            contentBox.classList.remove('is-scrolling');
        }, 800);
    });
}

// --- 7. INDÍTÁS ---
btn.addEventListener('click', getNewTopic);
window.addEventListener('load', () => setTimeout(getNewTopic, 300));