/**
 * TudásFalat - Teljes, Minden Funkciót Tartalmazó Logika
 */

// --- ELEMEK KIJELÖLÉSE ---
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

// --- HANGKEZELÉS ---
function playClickSound() {
    if (clickSound) {
        clickSound.pause();
        clickSound.currentTime = 0;
        clickSound.volume = 0.5;
        clickSound.play().catch(err => console.log("Hanglejátszási korlát a böngészőben."));
    }
}

// --- FORDÍTÓ MOTOR (Szigorú Magyarítás) ---
async function translateToHungarian(text) {
    if (!text || text.length < 2) return text;
    try {
        // Alulvonalak cseréje szóközre (Wiki címeknél fontos)
        const cleanText = text.replace(/_/g, ' ').trim();
        
        // MyMemory API hívás magyar-angol párral
        const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanText)}&langpair=en|hu`);
        const data = await res.json();
        
        if (data.responseStatus === 200) {
            return data.responseData.translatedText;
        }
        return cleanText; // Ha az API hibázik, az eredeti tisztított szöveg marad
    } catch (error) {
        console.error("Fordítási hiba:", error);
        return text;
    }
}

// --- FŐ FUNKCIÓ: ÚJ TÉMA LEKÉRÉSE ---
async function getNewTopic() {
    // 1. Előkészületek: gomb tiltása, hang, kártya kirepítése
    playClickSound();
    btn.disabled = true;
    btn.innerText = "SEARCHING...";
    
    // Kártya animáció indítása és Skeleton mutatása
    card.classList.add('card-exit');
    realContent.classList.add('hidden');
    skeletonLoader.classList.remove('hidden');

    try {
        // 2. Wikipedia API hívás (Véletlenszerű összefoglaló)
        const response = await fetch('https://en.wikipedia.org/api/rest_v1/page/random/summary');
        if (!response.ok) throw new Error("Hálózati hiba");
        const data = await response.json();

        // 3. Fordítás megvárása (Cím és Szöveg külön-külön)
        // A kettőt egyszerre indítjuk el a gyorsaság miatt (Promise.all)
        const [translatedTitle, translatedSummary] = await Promise.all([
            translateToHungarian(data.title),
            translateToHungarian(data.extract)
        ]);

        // 4. Adatok beillesztése a HTML-be (még rejtve)
        titleEl.innerText = translatedTitle;
        summaryEl.innerText = translatedSummary;
        linkEl.href = data.content_urls.desktop.page;

        // Kép kezelése
        if (data.originalimage && data.originalimage.source) {
            imageEl.src = data.originalimage.source;
            imageContainer.classList.remove('hidden');
            // Biztonsági elrejtés, ha a kép nem tölthető be
            imageEl.onerror = () => imageContainer.classList.add('hidden');
        } else {
            imageContainer.classList.add('hidden');
        }

        // 5. Animációs fázis: Várunk 500ms-t, hogy az animáció és a fordítás szép legyen
        setTimeout(() => {
            // Skeleton elrejtése, tartalom mutatása
            skeletonLoader.classList.add('hidden');
            realContent.classList.remove('hidden');
            
            // Görgetés vissza a kártya tetejére
            const contentBox = document.querySelector('.card-content');
            if (contentBox) contentBox.scrollTop = 0;

            // Kártya beúsztatása a túloldalról
            card.classList.remove('card-exit');
            card.classList.add('card-enter');

            setTimeout(() => {
                card.classList.remove('card-enter');
                btn.disabled = false;
                btn.innerText = "NEXT TOPIC";
            }, 100);
        }, 500);

    } catch (err) {
        console.error("Hiba:", err);
        btn.disabled = false;
        btn.innerText = "HIBA - ÚJRA";
        card.classList.remove('card-exit');
    }
}

// --- INTERAKTÍV KÁRTYA DŐLÉS (Tilt Effekt asztali gépre) ---
card.addEventListener('mousemove', (e) => {
    if (window.innerWidth < 768) return; // Mobilon ne dőljön
    
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    
    // Max 10 fokos dőlés
    const rotateX = (-y / (rect.height / 2)) * 10;
    const rotateY = (x / (rect.width / 2)) * 10;
    
    requestAnimationFrame(() => {
        card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
    });
});

card.addEventListener('mouseleave', () => {
    card.style.transform = `rotateX(0deg) rotateY(0deg) scale(1)`;
});

// --- ESEMÉNYFIGYELŐK ÉS INDÍTÁS ---
btn.addEventListener('click', getNewTopic);

// Első betöltéskor automatikus indítás egy kis késleltetéssel
window.addEventListener('load', () => {
    setTimeout(getNewTopic, 500);
});