// Constants
const API_BASE = 'https://api.aladhan.com/v1/timingsByCity';
const DEFAULT_METHOD = 2; // ISNA (Islamic Society of North America) - widely accepted
const DEFAULT_IQAMAH = {
    Fajr: "+20",
    Dhuhr: "+15",
    Asr: "+15",
    Maghrib: "+10",
    Isha: "+15",
    Jumuah: "12:30" // Default fixed time for Friday
};

// State
let prayerTimes = null;
let locationData = {
    city: localStorage.getItem('masjid_city') || '',
    country: localStorage.getItem('masjid_country') || ''
};
let iqamahSettings = JSON.parse(localStorage.getItem('masjid_iqamah')) || DEFAULT_IQAMAH;

let azanEnabled = localStorage.getItem('masjid_azan') === 'true';

// DOM Elements
const clockEl = document.getElementById('clock');
const dateEl = document.getElementById('date');
const locationDisplayEl = document.getElementById('location-display');
const prayerListEl = document.getElementById('prayer-list');
const nextNameEl = document.getElementById('next-prayer-name');
const countdownEl = document.getElementById('countdown');
const settingsModal = document.getElementById('settings-modal');
const settingsForm = document.getElementById('settings-form');
const cityInput = document.getElementById('city');
const countryInput = document.getElementById('country');
const audioBtn = document.getElementById('audio-btn');
const azanAudio = document.getElementById('azan-audio');

// Initialization
function init() {
    updateClock();
    setInterval(updateClock, 1000);

    // Initial load setup
    if (!locationData.city || !locationData.country) {
        openSettings();
    } else {
        fetchPrayerTimes();
    }

    // Event Listeners
    document.getElementById('settings-btn').addEventListener('click', openSettings);
    document.getElementById('close-modal').addEventListener('click', closeSettings);
    settingsForm.addEventListener('submit', handleSettingsSave);

    // Audio Toggle
    updateAudioBtn();
    audioBtn.addEventListener('click', () => {
        azanEnabled = !azanEnabled;
        localStorage.setItem('masjid_azan', azanEnabled);
        updateAudioBtn();
    });
}

function updateAudioBtn() {
    if (azanEnabled) {
        audioBtn.textContent = '🔔 Azan On';
        audioBtn.style.borderColor = 'var(--success-color)';
        audioBtn.style.color = 'var(--success-color)';
    } else {
        audioBtn.textContent = '🔕 Azan Off';
        audioBtn.style.borderColor = 'var(--text-secondary)';
        audioBtn.style.color = 'var(--text-secondary)';
        azanAudio.pause();
        azanAudio.currentTime = 0;
    }
}

// Clock & Date
function updateClock() {
    const now = new window.Date(); // Use window.Date to avoid conflict if Date is shadowed

    // Time
    const timeString = now.toLocaleTimeString('en-US', { hour12: false });
    clockEl.textContent = timeString;

    // Date
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateEl.textContent = now.toLocaleDateString('en-US', options);

    if (prayerTimes) {
        updateNextPrayer(now);
    }
}

// API Fetch
async function fetchPrayerTimes() {
    if (!locationData.city || !locationData.country) return;

    locationDisplayEl.textContent = `${locationData.city}, ${locationData.country}`;

    // Show loading state in list (preserve header)
    // prayerListEl.innerHTML = '...'; // We need to be careful not to wipe header if we want to keep it stationary, but for now re-rendering whole list is fine or we Append.
    // Actually, let's just keep the header in HTML and append items.
    // For simplicity, I'll clear and re-add header + items in render.

    try {
        const today = new window.Date();
        const dateStr = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;

        // Check if we need to refetch (e.g. data is from yesterday) implementation later
        // For now, simple fetch
        const url = `${API_BASE}?city=${encodeURIComponent(locationData.city)}&country=${encodeURIComponent(locationData.country)}&method=${DEFAULT_METHOD}`;
        console.log("Fetching:", url);

        const response = await fetch(url);
        const data = await response.json();

        if (data.code === 200) {
            prayerTimes = data.data.timings;
            renderPrayerTimes();
        } else {
            console.error('API Error:', data);
            locationDisplayEl.textContent = 'Error fetching times. Check settings.';
        }
    } catch (error) {
        console.error('Fetch Error:', error);
        locationDisplayEl.textContent = 'Network Error. Retrying...';
        setTimeout(fetchPrayerTimes, 5000); // Retry after 5s
    }
}

// Render List
function renderPrayerTimes() {
    if (!prayerTimes) return;

    const prayersToDisplay = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

    // Clear list but keep header? Or just re-create all.
    prayerListEl.innerHTML = `
        <div class="prayer-header">
            <span>Prayer</span>
            <span>Azan</span>
            <span>Iqamah</span>
        </div>
    `;

    // Check if it's Friday for Jumuah
    const today = new window.Date();
    const isFriday = today.getDay() === 5;

    prayersToDisplay.forEach(name => {
        let azanTime = prayerTimes[name]; // "HH:MM"
        let displayName = name;
        let iqamahTime = calculateIqamah(name, azanTime);

        // Special handling for Friday Dhuhr -> Jumuah
        if (isFriday && name === 'Dhuhr') {
            displayName = 'Jumuah';
            // Use Jumuah fixed time if set, else standard Dhuhr logic
            if (iqamahSettings['Jumuah']) {
                iqamahTime = calculateIqamah('Jumuah', azanTime); // Usually fixed
            }
        }

        const div = document.createElement('div');
        div.className = 'prayer-item';
        div.id = `prayer-${name}`;

        div.innerHTML = `
            <span class="prayer-name">${displayName}</span>
            <span class="prayer-time">${formatTime12(azanTime)}</span>
            <span class="prayer-iqamah">${formatTime12(iqamahTime)}</span>
        `;

        prayerListEl.appendChild(div);
    });
}

function calculateIqamah(name, azanTime) {
    const setting = iqamahSettings[name] || DEFAULT_IQAMAH[name] || "+10";

    // Fixed time logic (e.g. "13:30")
    if (!setting.startsWith('+')) {
        return setting;
    }

    // Offset logic (e.g. "+15")
    if (!azanTime) return '--:--';

    const [h, m] = azanTime.split(':').map(Number);
    const offset = parseInt(setting.replace('+', ''));

    const date = new window.Date();
    date.setHours(h, m + offset, 0, 0);

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

function formatTime12(time24) {
    if (!time24) return '--:--';
    // Clean string "12:34" or "12:34 (EST)"
    let [hours, minutes] = time24.split(':');
    minutes = minutes.substring(0, 2); // remove timezone extras

    hours = parseInt(hours);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    return `${hours}:${minutes} <small>${ampm}</small>`;
}

// Logic: Next Prayer & Countdown
function updateNextPrayer(now) {
    if (!prayerTimes) return;

    // Ordered list of daily prayers + 'Fajr' (tomorrow) for cycle
    const displayList = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

    // Find next prayer
    let nextPrayer = null;
    let minDiff = Infinity;
    let nextPrayerTimeDate = null;

    // Iterate through today's prayers
    for (const name of displayList) {
        const timeStr = prayerTimes[name]; // "HH:MM"
        const [h, m] = timeStr.split(':');

        const pDate = new window.Date(now);
        pDate.setHours(parseInt(h), parseInt(m), 0, 0);

        if (pDate > now) {
            // This is a future prayer today
            const diff = pDate - now;
            if (diff < minDiff) {
                minDiff = diff;
                nextPrayer = name;
                nextPrayerTimeDate = pDate;
            }
        }
    }

    // If no prayer found today (after Isha), next is Fajr tomorrow
    if (!nextPrayer) {
        nextPrayer = 'Fajr';
        const timeStr = prayerTimes['Fajr'];
        const [h, m] = timeStr.split(':');
        nextPrayerTimeDate = new window.Date(now);
        nextPrayerTimeDate.setDate(now.getDate() + 1);
        nextPrayerTimeDate.setHours(parseInt(h), parseInt(m), 0, 0);
    }

    // Update UI Elements
    nextNameEl.textContent = nextPrayer;

    // Countdown
    const diff = nextPrayerTimeDate - now;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    countdownEl.textContent =
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    // Highlight active prayer in list
    document.querySelectorAll('.prayer-item').forEach(item => {
        item.classList.remove('active');
        if (item.id === `prayer-${nextPrayer}`) {
            item.classList.add('active'); // Actually, active usually means "current time period".
            // For simple display, let's highlight the NEXT one as "Upcoming" or highlight the CURRENT one?
            // User request usually: Highlight the *current* prayer period, or *next*?
            // Let's highlight the *next* per my CSS class `.prayer-item.active`.
            // Wait, usually "active" means "Now". Let's change logic:
            // Highlight the one we are waiting for? Or the one we are in?
            // "Next Prayer" box shows what we are waiting for.
            // List usually highlights the *Next* one to catch attention for when to pray.
            // I'll stick to Highlighting NEXT for now as it matches the "Countdown".
        }
    });

    // Check for Azan Trigger (e.g., within 2 seconds of start)
    // Note: setInterval runs every 1s, so we might miss exact ms.
    // Check if diff is very small (positive)
    if (diff <= 1000 && diff > 0 && azanEnabled) {
        playAzan();
    }
}

function playAzan() {
    if (azanAudio.paused) {
        azanAudio.play().catch(e => console.log("Audio play blocked:", e));
    }
}

// Settings Handling
function openSettings() {
    cityInput.value = locationData.city;
    countryInput.value = locationData.country;

    // Populate Iqamah inputs
    document.getElementById('iqamah-Fajr').value = iqamahSettings.Fajr || '';
    document.getElementById('iqamah-Dhuhr').value = iqamahSettings.Dhuhr || '';
    document.getElementById('iqamah-Asr').value = iqamahSettings.Asr || '';
    document.getElementById('iqamah-Maghrib').value = iqamahSettings.Maghrib || '';
    document.getElementById('iqamah-Isha').value = iqamahSettings.Isha || '';
    document.getElementById('iqamah-Jumuah').value = iqamahSettings.Jumuah || '';

    settingsModal.classList.remove('hidden');
}

function closeSettings() {
    settingsModal.classList.add('hidden');
}

function handleSettingsSave(e) {
    e.preventDefault();
    const newCity = cityInput.value.trim();
    const newCountry = countryInput.value.trim();

    if (newCity && newCountry) {
        // Save Location
        locationData.city = newCity;
        locationData.country = newCountry;
        localStorage.setItem('masjid_city', newCity);
        localStorage.setItem('masjid_country', newCountry);

        // Save Iqamah
        iqamahSettings = {
            Fajr: document.getElementById('iqamah-Fajr').value.trim() || DEFAULT_IQAMAH.Fajr,
            Dhuhr: document.getElementById('iqamah-Dhuhr').value.trim() || DEFAULT_IQAMAH.Dhuhr,
            Asr: document.getElementById('iqamah-Asr').value.trim() || DEFAULT_IQAMAH.Asr,
            Maghrib: document.getElementById('iqamah-Maghrib').value.trim() || DEFAULT_IQAMAH.Maghrib,
            Isha: document.getElementById('iqamah-Isha').value.trim() || DEFAULT_IQAMAH.Isha,
            Jumuah: document.getElementById('iqamah-Jumuah').value.trim() || DEFAULT_IQAMAH.Jumuah
        };
        localStorage.setItem('masjid_iqamah', JSON.stringify(iqamahSettings));

        closeSettings();
        fetchPrayerTimes(); // Re-fetch/Re-render
    }
}

// Run
init();
