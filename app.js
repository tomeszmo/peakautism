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

// --- 2. ELEMEK LEKÉRÉSE (Ellenőrizd a HTML-ben az ID-kat!) ---
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

// --- 4. A FŐ FUNKCIÓ (SCROLL RESET + SKELETON + 1S WAIT) ---
async function getNewTopic() {
    requestMotionPermission(); // <--- EZT ADTAM HOZZÁ: Minden kártyaváltásnál megpróbálja aktiválni a szenzort
    
    if (isDealing) return;
    isDealing = true;
    isLocked = true;
    
    card.style.opacity = "1";
    card.style.transform = "translateX(0) rotate(0deg) scale(1)";
    card.classList.remove('hidden'); 
    
    // Skeleton mutatása, tartalom elrejtése az elején
    if (skeletonLoader) skeletonLoader.classList.remove('hidden');
    if (realContent) realContent.classList.add('hidden');

    // UI ELŐKÉSZÍTÉSE
    if (skeletonLoader) skeletonLoader.classList.remove('hidden');
    if (realContent) realContent.classList.add('hidden');
    if (imageContainer) imageContainer.classList.add('hidden');
    
    // SCROLL RESET - Megkeressük a görgethető dobozt
    const contentBox = document.querySelector('.card-content');
    if (contentBox) {
        contentBox.scrollTop = 0;
        contentBox.style.overflowY = "hidden";
    }

    const startTime = Date.now();

    try {
        const response = await fetch('https://en.wikipedia.org/api/rest_v1/page/random/summary');
        const data = await response.json();

        // Fordítás és Kép párhuzamosan
        const translationPromise = Promise.all([
            translateToHungarian(data.title),
            translateToHungarian(data.extract)
        ]);
        const imagePromise = data.originalimage ? loadImage(data.originalimage.source) : Promise.resolve();

        const [translations] = await Promise.all([translationPromise, imagePromise]);
        const [tTitle, tSum] = translations;

        // Minimum 1 másodperc várakozás
        const elapsed = Date.now() - startTime;
        if (elapsed < 1000) await new Promise(r => setTimeout(r, 1000 - elapsed));

        // ADATOK BEHELYEZÉSE
        if (titleEl) titleEl.innerText = tTitle || data.title;
        if (summaryEl) summaryEl.innerText = tSum || data.extract;
        if (linkEl) linkEl.href = data.content_urls.desktop.page;
        if (imageEl && data.originalimage) {
            imageEl.src = data.originalimage.source;
            imageContainer.classList.remove('hidden');
        }

        // --- 1. ADATOK BEILLESZTÉSE ---
titleEl.innerText = tTitle || data.title;
summaryEl.innerText = tSum || data.extract;
linkEl.href = data.content_urls.desktop.page;

// --- 2. AZONNALI TETEJÉRE UGRÁS (A TITOK) ---
const contentBox = document.querySelector('.card-content');
if (contentBox) {
    // Először nullázzuk a pozíciót
    contentBox.scrollTop = 0;
    
    // Majd egy "mikro-várakozással" kényszerítjük a böngészőt, 
    // hogy az új, már renderelt szöveg tetejére ugorjon
    requestAnimationFrame(() => {
        contentBox.scrollTo({ top: 0, behavior: 'instant' });
        contentBox.scrollTop = 0;
    });
}

        // Számláló növelése
        topicCount++;
        if (countEl) countEl.innerText = topicCount;

        // Színváltás (Blobok)
        const hue = Math.floor(Math.random() * 360);
        document.querySelectorAll('.blob').forEach((b, i) => {
            b.style.background = `hsla(${hue + (i * 25)}, 75%, 50%, 0.5)`;
        });

        // MEGJELENÍTÉS
        if (skeletonLoader) skeletonLoader.classList.add('hidden');
        if (realContent) realContent.classList.remove('hidden');
        card.classList.add('card-dealing');

        setTimeout(() => {
            card.classList.remove('card-dealing');
            isDealing = false;
            isLocked = false;
            lerpFactor = 0.001;
            if (contentBox) contentBox.style.overflowY = "auto";
            
            let speedUp = setInterval(() => {
                if (lerpFactor < 0.08) lerpFactor += 0.005;
                else clearInterval(speedUp);
            }, 50);
        }, 800);

    } catch (err) {
        console.error("Hiba történt:", err);
        isDealing = false;
        isLocked = false;
        if (skeletonLoader) skeletonLoader.classList.add('hidden');
    }
}

// --- 5. MOZGÁS ÉS SWIPE (PC ÉS MOBIL) ---
function updateMotion() {
    if (isLocked || isDragging) {
        tgtX = 0; 
        tgtY = 0;
    }

    curX += (tgtX - curX) * lerpFactor;
    curY += (tgtY - curY) * lerpFactor;

    // 1. A KÁRTYA ALAP MOZGÁSA
    if (card) {
        card.style.transform = `rotateX(${curX}deg) rotateY(${curY}deg)`;
    }

    // 2. A KÉP KIEMELÉSE (Ez adja a mélységet a kártyán belül)
    const img = document.getElementById('topic-image');
    if (img) {
        // A translateZ(40px) miatt a kép "lebeg" a kártya felett
        img.style.transform = `rotateX(${curX}deg) rotateY(${curY}deg) translateZ(40px)`;
    }

    // 3. HÁTTÉR BLOBOK ELLENTÉTES MOZGÁSA (Parallax háttér)
    document.querySelectorAll('.blob').forEach((blob, index) => {
        const intensity = (index + 1) * 12; 
        // Ha a kártyát jobbra döntöd (curY), a háttér balra úszik (-curY)
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

// Swipe kezelők
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
    if (Math.abs(currentTranslateX) > 120) {
        card.style.opacity = '0';
        setTimeout(() => { getNewTopic(); resetPos(); }, 200);
    } else { resetPos(); }
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

// INDÍTÁS
updateMotion();
window.addEventListener('load', () => setTimeout(getNewTopic, 300));

// --- MOBIL SZENZOR KEZELÉS ---
function handleOrientation(event) {
    // Csak mobil nézetben és ha nem húzzuk a kártyát
    if (window.innerWidth >= 768 || isLocked || isDragging) return;

    // Beta: előre-hátra (X tengely), Gamma: balra-jobbra (Y tengely)
    // A -45 korrekció azért kell, mert a telefont általában döntve tartjuk
    tgtX = Math.max(Math.min((event.beta - 45) / 1.5, 12), -12);
    tgtY = Math.max(Math.min(event.gamma / 1.5, 12), -12);
}

// iOS 13+ specifikus engedélykérés
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
        // Android vagy régebbi iOS esetén simán hozzáadjuk
        window.addEventListener('deviceorientation', handleOrientation);
    }
}

// --- JAVÍTOTT LERP (SIMÍTÁS) A RENDERBEN ---
function updateMotion() {
    // Ha húzzuk a kártyát, a dőlés célértéke legyen 0, hogy ne zavarja a swipe-ot
    if (isLocked || isDragging) {
        tgtX = 0; tgtY = 0;
    }

    // A LERP algoritmus: cur + (target - cur) * factor
    curX += (tgtX - curX) * lerpFactor;
    curY += (tgtY - curY) * lerpFactor;

    // Alkalmazás a kártyára
    if (card && !isDealing && !isDragging) {
        card.style.transform = `rotateX(${curX}deg) rotateY(${curY}deg)`;
    }

    // Parallax buborékok (ellentétes irányú, lágy mozgás)
    document.querySelectorAll('.blob').forEach((blob, index) => {
        const intensity = (index + 1) * 12; 
        blob.style.transform = `translate(${-curY * intensity}px, ${curX * intensity}px)`;
    });

    requestAnimationFrame(updateMotion);
}


