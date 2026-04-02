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

window.isHungarian = true; // Használjuk egységesen a window objektumot
let motionEnabled = false; // Alapból ki van kapcsolva a mozgás, amíg nem kérik

// Kedvencek betöltése a memóriából (Egységes kulcs használata)
let favorites = JSON.parse(localStorage.getItem('peak_autism_favs')) || [];

window.onload = function() {
    // Ellenőrizzük, hogy mobil-e és kell-e engedély
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (isMobile) {
        // Ha iOS 13+, akkor kell az engedélykérés gomb
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            document.getElementById('gyro-popup').classList.remove('hidden');
        } else {
            // Android vagy régi iOS: itt általában egyből mehet, de a popupot itt is mutathatod
            // ha csak akkor akarod bekapcsolni, ha a felhasználó rábólint.
            document.getElementById('gyro-popup').classList.remove('hidden');
        }
    }
};

function setupGyro(isRequested) {
    const popup = document.getElementById('gyro-popup');
    popup.classList.add('hidden');

    if (isRequested) {
        // iOS 13+ engedélykérés folyamata
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then(permissionState => {
                    if (permissionState === 'granted') {
                        window.addEventListener('deviceorientation', handleGyro);
                    }
                })
                .catch(console.error);
        } else {
            // Nem iOS (Android), egyszerűen csak elindítjuk a figyelést
            window.addEventListener('deviceorientation', handleGyro);
        }
    }
}

// A függvény, ami ténylegesen mozgatja a kártyát
function handleGyro(event) {
    const x = event.beta;  // Előre-hátra döntés (-180 to 180)
    const y = event.gamma; // Jobbra-balra döntés (-90 to 90)

    const card = document.getElementById('main-card');
    if (!card) return;

    // Érzékenység állítása (osztjuk, hogy ne legyen túl vad)
    const tiltX = (x - 45) * 0.5; // 45 fokos tartásra optimalizálva
    const tiltY = y * 0.5;

    card.style.transform = `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
}

// --- KEDVENCEK RENDSZER (JAVÍTOTT & INTEGRÁLT) ---
function updateFavUI() {
    const heartBtn = document.getElementById('heart-btn');
    if (!currentCardData || !heartBtn) return;

    // Megnézzük, hogy az aktuális kártya ID-ja szerepel-e a mentettek között
    const isFav = favorites.some(f => f.pageid === currentCardData.pageid);
    
    // Frissítjük az ikont (Detailed View kompatibilis)
    heartBtn.innerHTML = isFav ? '<span class="heart-icon heart-filled">❤️</span>' : '<span class="heart-icon">🤍</span>';
}

function toggleFavorite(event) {
    if (event) {
        event.stopPropagation(); // Megállítja a kártya elhúzását kattintáskor
        event.preventDefault();
    }
    
    if (!currentCardData) return;

    const index = favorites.findIndex(f => f.pageid === currentCardData.pageid);

    if (index > -1) {
        favorites.splice(index, 1); // Kivétel a listából
    } else {
        // Mentés minden szükséges adattal a visszatöltéshez
        favorites.push({
            pageid: currentCardData.pageid,
            title: titleEl.innerText,
            summary: summaryEl.innerText,
            image: imageEl.src,
            url: linkEl.href
        });
    }

    // Mentés a böngésző memóriájába
    localStorage.setItem('peak_autism_favs', JSON.stringify(favorites));
    updateFavUI();
}

function toggleFavoritesModal() {
    const modal = document.getElementById('favorites-overlay') || document.getElementById('fav-modal');
    const list = document.getElementById('favorites-list') || document.getElementById('fav-list');
    
    if (!modal || !list) return;

    if (modal.classList.contains('hidden')) {
        list.innerHTML = ""; // Üresre takarítjuk (ha nincs mentett, üres marad)
        
        favorites.forEach((fav, index) => {
            const item = document.createElement('div');
            item.className = 'fav-item'; // Stílus a galériához
            item.onclick = () => loadFavoriteCard(index);
            item.innerHTML = `
                <img src="${fav.image}" style="width:50px; height:50px; border-radius:8px; object-fit:cover;">
                <div class="fav-item-info">
                    <h4>${fav.title}</h4>
                </div>
            `;
            list.appendChild(item);
        });
        modal.classList.remove('hidden');
    } else {
        modal.classList.add('hidden');
    }
}

// KIVÁLASZTOTT KEDVENC VISSZATÖLTÉSE A FŐ KÁRTYÁRA
function loadFavoriteCard(index) {
    const fav = favorites[index];
    
    // Adatok szimulálása a kártya számára
    currentCardData = {
        pageid: fav.pageid,
        title: fav.title,
        extract: fav.summary,
        content_urls: { desktop: { page: fav.url } },
        originalimage: fav.image.includes('placeholder') ? null : { source: fav.image }
    };

    // UI frissítése
    titleEl.innerText = fav.title;
    summaryEl.innerText = fav.summary;
    linkEl.href = fav.url;
    
    if (fav.image && !fav.image.includes('undefined')) {
        imageEl.src = fav.image;
        imageContainer.classList.remove('hidden');
    } else {
        imageContainer.classList.add('hidden');
    }

    updateFavUI();
    toggleFavoritesModal(); // Bezárjuk a galériát
    
    // Vizuális visszajelzés (pici ugrás)
    card.style.transform = "scale(0.98)";
    setTimeout(() => card.style.transform = "scale(1)", 150);
}

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
    if (!text || text.trim().length < 2) return text;
    try {
        // Tisztítás: Wikipedia néha furcsa karaktereket hagy benne
        const cleanText = text.replace(/<(?:.|\n)*?>/gm, '').trim();
        
        const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanText)}&langpair=en|hu`);
        const data = await res.json();
        
        if (data.responseStatus === 200 && data.responseData.translatedText) {
            return data.responseData.translatedText;
        }
        return cleanText; // Ha az API korlátba ütközik, az eredetit adja vissza
    } catch (error) { 
        return text; 
    }
}

// --- DEEP DIVE FUNKCIÓ ---
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

            if (window.isHungarian) {
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
    
    updateFavUI();

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
        
        if (window.isHungarian) {
            try {
                const [translatedTitle, translatedSum] = await Promise.all([
                    translateToHungarian(data.title),
                    translateToHungarian(data.extract)
                ]);
                tTitle = translatedTitle;
                tSum = translatedSum;
            } catch (e) { console.warn("Fordítás sikertelen."); }
        }

        if (data.originalimage) {
            await loadImage(data.originalimage.source);
        }

        topicCount++; 
        if (countEl) countEl.innerText = topicCount;

        const elapsed = Date.now() - startTime;
        if (elapsed < 1000) await new Promise(r => setTimeout(r, 1000 - elapsed));

        titleEl.innerText = tTitle;
        summaryEl.innerText = tSum;
        linkEl.href = data.content_urls.desktop.page;
        
        if (imageEl && data.originalimage) {
            imageEl.src = data.originalimage.source;
            imageContainer.classList.remove('hidden');
        }

        updateFavUI();
        if (typeof updateBlobColors === 'function') updateBlobColors();

        skeletonLoader.classList.add('hidden');
        realContent.classList.remove('hidden');
        
        if (contentBox) {
            contentBox.scrollTop = 0;
            requestAnimationFrame(() => {
                contentBox.scrollTo({ top: 0, behavior: 'instant' });
                contentBox.style.overflowY = "auto";
            });
        }

        if (card) {
            card.classList.add('card-dealing');
            setTimeout(() => {
                card.classList.remove('card-dealing');
                isDealing = false;
                isLocked = false; 
                lerpFactor = 0.001; 
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
    card.style.transform = `translateX(${currentTranslateX}px) rotate(${currentTranslateX / 10}deg)`;
    card.style.opacity = 1 - Math.abs(currentTranslateX) / 600;
};

const dragEnd = () => {
    if (!isDragging) return;
    isDragging = false;
    if (Math.abs(currentTranslateX) > 120) {
        card.style.opacity = '0';
        setTimeout(() => { getNewTopic(); resetPos(); }, 200);
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
                if (response === 'granted') window.addEventListener('deviceorientation', handleOrientation);
            })
            .catch(console.error);
    } else {
        window.addEventListener('deviceorientation', handleOrientation);
    }
}

async function enableMotion() {
    await requestMotionPermission();
    motionEnabled = true;
    const overlay = document.getElementById('motion-overlay');
    if (overlay) overlay.style.display = 'none';
}

async function toggleLanguage() {
    const checkbox = document.getElementById('lang-toggle');
    if (!checkbox) return;

    window.isHungarian = checkbox.checked;
    
    // Frissítsük a címkét is (opcionális, ha van lang-label-ed)
    console.log("Nyelv váltva: " + (window.isHungarian ? "HU" : "EN"));

    if (!currentCardData) return;

    // Vizuális jelzés, hogy tölt a fordítás
    realContent.style.opacity = "0.5";

    try {
        if (window.isHungarian) {
            // Fordítás magyarra
            const [tTitle, tSum] = await Promise.all([
                translateToHungarian(currentCardData.title),
                translateToHungarian(currentCardData.extract)
            ]);
            titleEl.innerText = tTitle;
            summaryEl.innerText = tSum;
        } else {
            // Visszaállítás az eredeti angolra (ami a Wikipédiából jött)
            titleEl.innerText = currentCardData.title;
            summaryEl.innerText = currentCardData.extract;
        }
    } catch (error) {
        console.error("Hiba a nyelvváltásnál:", error);
    } finally {
        realContent.style.opacity = "1";
    }
}

function updateBlobColors() {
    const colors = ['rgba(255, 99, 132, 0.4)', 'rgba(54, 162, 235, 0.4)', 'rgba(255, 206, 86, 0.4)'];
    document.querySelectorAll('.blob').forEach(blob => {
        blob.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    });
}

document.addEventListener("DOMContentLoaded", () => {
    updateMotion();
    getNewTopic();
});

function removeFavorite(event, index) {
    event.stopPropagation(); // Ez megállítja a kártya betöltődését!
    
    favorites.splice(index, 1);
    localStorage.setItem('peak_autism_favs', JSON.stringify(favorites));
    
    // Frissítjük a kijelzőt (újrarajzoljuk a listát bezárás nélkül)
    const modal = document.getElementById('fav-modal');
    modal.classList.add('hidden'); 
    toggleFavoritesModal(); // Újranyitja a frissített listával
    
    // Főoldali szív ikon frissítése
    if (typeof updateFavUI === "function") updateFavUI();
}

