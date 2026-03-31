/**
 * PEAK AUTISM - Teljes Logika
 * Funkciók: 3mp fix betöltés, fordítás, dummy-card kezelés, 
 * szinkronizált egér- és giroszkóp alapú dőlés.
 */

// --- 1. ELEMEK KIJELÖLÉSE ---
const titleEl = document.getElementById('topic-title');
const summaryEl = document.getElementById('summary-text');
const linkEl = document.getElementById('source-link');
const btn = document.getElementById('new-topic-btn');
const card = document.getElementById('main-card');
const cardStack = document.querySelector('.card-stack'); 
const imageEl = document.getElementById('topic-image');
const imageContainer = document.getElementById('card-image-container');
const clickSound = document.getElementById('click-sound');
const skeletonLoader = document.getElementById('skeleton-loader');
const realContent = document.getElementById('real-content');

// --- 2. HANGKEZELÉS ---
function playClickSound() {
    if (clickSound) {
        clickSound.pause();
        clickSound.currentTime = 0;
        clickSound.volume = 0.4;
        clickSound.play().catch(() => {});
    }
}

// --- 3. FORDÍTÓ MOTOR ---
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

// --- 4. FŐ FUNKCIÓ: ÚJ TÉMA LEKÉRÉSE ---
async function getNewTopic() {
    // Első kattintáskor engedélyt kérünk a giroszkóphoz (iOS specifikus)
    requestDeviceOrientation();
    
    playClickSound();
    btn.disabled = true;
    btn.innerText = "SEARCHING...";

    card.style.opacity = "0";
    const minWaitTimer = new Promise(resolve => setTimeout(resolve, 3000));

    try {
        const fetchTask = (async () => {
            const response = await fetch('https://en.wikipedia.org/api/rest_v1/page/random/summary');
            if (!response.ok) throw new Error("Wiki hiba");
            const data = await response.json();

            const [tTitle, tSummary] = await Promise.all([
                translateToHungarian(data.title),
                translateToHungarian(data.extract)
            ]);

            return { data, tTitle, tSummary };
        })();

        const [result] = await Promise.all([fetchTask, minWaitTimer]);
        const { data, tTitle, tSummary } = result;

        realContent.classList.add('hidden');
        skeletonLoader.classList.remove('hidden');

        titleEl.innerText = tTitle;
        summaryEl.innerText = tSummary;
        linkEl.href = data.content_urls.desktop.page;

        if (data.originalimage && data.originalimage.source) {
            imageEl.src = data.originalimage.source;
            imageContainer.classList.remove('hidden');
            imageEl.onerror = () => imageContainer.classList.add('hidden');
        } else {
            imageContainer.classList.add('hidden');
        }

        const contentBox = card.querySelector('.card-content');
        if (contentBox) contentBox.scrollTop = 0;

        skeletonLoader.classList.add('hidden');
        realContent.classList.remove('hidden');

        card.style.opacity = "1";
        btn.disabled = false;
        btn.innerText = "NEXT TOPIC";

    } catch (err) {
        console.error(err);
        await minWaitTimer;
        btn.disabled = false;
        btn.innerText = "ERROR - RETRY";
        card.style.opacity = "1";
    }
}

// --- 5. DŐLÉS EFFEKTUSOK (ASZTALI + MOBIL) ---

// ASZTALI: Egérmozgás alapú dőlés
// Csak a kártya feletti mozgásra figyelünk a természetesebb érzetért
card.addEventListener('mousemove', (e) => {
    if (window.innerWidth < 768 || !cardStack) return;
    
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    
    const rotateX = (-y / (rect.height / 2)) * 10;
    const rotateY = (x / (rect.width / 2)) * 10;
    
    cardStack.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
});

card.addEventListener('mouseleave', () => {
    if (window.innerWidth >= 768 && cardStack) {
        cardStack.style.transform = `rotateX(0deg) rotateY(0deg)`;
    }
});

// MOBIL: Giroszkóp alapú dőlés
function handleOrientation(event) {
    if (window.innerWidth >= 768 || !cardStack) return;

    // béta: előre-hátra dőlés (-180-tól 180-ig)
    // gamma: balra-jobbra dőlés (-90-től 90-ig)
    const beta = event.beta; 
    const gamma = event.gamma;

    // Normalizáljuk az értékeket, hogy ne dőljön túl nagyot (max 15 fok)
    const rotX = Math.max(Math.min((beta - 45) / 2, 15), -15);
    const rotY = Math.max(Math.min(gamma / 2, 15), -15);

    cardStack.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
}

// iOS engedélykérés a szenzorokhoz
function requestDeviceOrientation() {
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

// --- 6. INDÍTÁS ---
btn.addEventListener('click', getNewTopic);

window.addEventListener('load', () => {
    getNewTopic();
});