// Constants
const API_BASE = 'https://api.aladhan.com/v1/timingsByCity';
const DEFAULT_METHOD = 1; // University of Islamic Sciences, Karachi (Common for India)
const DEFAULT_IQAMAH = {
    Fajr: "+20",
    Dhuhr: "+15",
    Asr: "+15",
    Maghrib: "+10",
    Isha: "+15",
    Jumuah: "12:30" // Default fixed time for Friday
};
const DEFAULT_ADJUSTMENTS = {
    Fajr: 0,
    Dhuhr: 0,
    Asr: 0,
    Maghrib: 0,
    Isha: 0
};
const DEFAULT_TICKER = "Welcome to the Masjid. Please silence your mobile phones.";

// State
let prayerTimes = null;
let hijriDate = "";
let locationData = {
    city: localStorage.getItem('masjid_city') || 'Kalpetta',
    country: localStorage.getItem('masjid_country') || 'India'
};
let calcMethod = localStorage.getItem('masjid_calc_method') || DEFAULT_METHOD;
let asrMethod = localStorage.getItem('masjid_asr_method') || 0; // 0=Standard, 1=Hanafi
let timeAdjustments = JSON.parse(localStorage.getItem('masjid_adjustments')) || DEFAULT_ADJUSTMENTS;
let iqamahSettings = JSON.parse(localStorage.getItem('masjid_iqamah')) || DEFAULT_IQAMAH;
let tickerText = localStorage.getItem('masjid_ticker') || DEFAULT_TICKER;

let azanEnabled = localStorage.getItem('masjid_azan') === 'true';

// DOM Elements
const clockEl = document.getElementById('clock');
const dateEl = document.getElementById('date');
const hijriDateEl = document.getElementById('hijri-date');
const locationDisplayEl = document.getElementById('location-display');
const prayerListEl = document.getElementById('prayer-list');
const nextNameEl = document.getElementById('next-prayer-name');
const countdownEl = document.getElementById('countdown');
const tickerContentEl = document.getElementById('ticker-content');
const settingsModal = document.getElementById('settings-modal');
const settingsForm = document.getElementById('settings-form');
const cityInput = document.getElementById('city');
const countryInput = document.getElementById('country');
const tickerInput = document.getElementById('ticker-text');
const audioBtn = document.getElementById('audio-btn');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const azanAudio = document.getElementById('azan-audio');
const duaOverlay = document.getElementById('dua-overlay');

// Initialization
function init() {
    updateClock();
    setInterval(updateClock, 1000);
    // Explicitly set ticker to avoid blinking hardcoded text if any (though we removed it)
    tickerContentEl.textContent = tickerText;

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

    fullscreenBtn.addEventListener('click', toggleFullscreen);

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
    const timeString = now.toLocaleTimeString('en-US', { hour12: true });
    clockEl.textContent = timeString;

    // Auto-refresh at midnight (00:00:01)
    if (now.getHours() === 0 && now.getMinutes() === 0 && now.getSeconds() === 1) {
        location.reload();
    }

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
        const url = `${API_BASE}?city=${encodeURIComponent(locationData.city)}&country=${encodeURIComponent(locationData.country)}&method=${calcMethod}&school=${asrMethod}`;
        console.log("Fetching:", url);

        const response = await fetch(url);
        const data = await response.json();

        if (data.code === 200) {
            prayerTimes = data.data.timings;
            // Hijri Date
            const hijri = data.data.date.hijri;
            hijriDate = `${hijri.day} ${hijri.month.en} ${hijri.year}`;
            hijriDateEl.textContent = hijriDate;

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
        let rawAzanTime = prayerTimes[name]; // "HH:MM"
        let azanTime = applyAdjustment(rawAzanTime, timeAdjustments[name]);

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

        // Insert Sunrise after Fajr
        if (name === 'Fajr') {
            const sunriseTime = prayerTimes['Sunrise'];
            if (sunriseTime) {
                const sDiv = document.createElement('div');
                sDiv.className = 'prayer-item sunrise';
                sDiv.innerHTML = `
                    <span class="prayer-name">Sunrise</span>
                    <span class="prayer-time">${formatTime12(sunriseTime)}</span>
                    <span class="prayer-iqamah">Ishraq</span>
                `;
                prayerListEl.appendChild(sDiv);
            }
        }
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

function applyAdjustment(timeStr, adjustmentMinutes) {
    if (!timeStr || !adjustmentMinutes || adjustmentMinutes == 0) return timeStr;

    const [h, m] = timeStr.split(':').map(Number);
    const date = new window.Date();
    date.setHours(h, m + parseInt(adjustmentMinutes), 0, 0);

    const newH = String(date.getHours()).padStart(2, '0');
    const newM = String(date.getMinutes()).padStart(2, '0');
    return `${newH}:${newM}`;
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

    // --- Logic for Iqamah Countdown ---
    // Check if we are currently "in" a prayer time (Between Azan and Iqamah)
    let showingIqamah = false;
    let targetDate = nextPrayerTimeDate; // Default target is Next Azan
    let statusText = nextPrayer; // Default text

    // Check Previous Prayer (to see if we are waiting for its Iqamah)
    // iterate displayList again to find which window we are in
    for (const name of displayList) {
        const azanStr = prayerTimes[name];
        const [ah, am] = azanStr.split(':');
        const aDate = new window.Date(now);
        aDate.setHours(parseInt(ah), parseInt(am), 0, 0);

        // Get Iqamah Time
        let iqamahStr = calculateIqamah(name, azanStr);
        // If iqamahStr is offset e.g. "+15" (shouldn't happen as calculateIqamah returns time, but let's be safe), 
        // calculateIqamah returns formatted time "HH:MM", wait, let's check `calculateIqamah` implementation.
        // It returns "HH:MM" (24h format in string).

        if (iqamahStr !== '--:--') {
            const [ih, im] = iqamahStr.split(':');
            const iDate = new window.Date(now);
            iDate.setHours(parseInt(ih), parseInt(im), 0, 0);

            // Special case for Jumuah/Friday
            // If it's Friday and Dhuhr, we treat it as Jumuah
            // But logic inside render handles name change. Here we use 'Dhuhr' key.

            // If NOW is between Azan and Iqamah
            if (now >= aDate && now < iDate) {
                // We are waiting for Iqamah!
                targetDate = iDate;
                showingIqamah = true;
                statusText = `${name} Iqamah`;
                break;
            }
        }
    }

    // Update UI Elements
    nextNameEl.textContent = statusText;

    // Countdown
    let diff = targetDate - now;
    if (diff < 0) diff = 0;

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    countdownEl.textContent =
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    // Styles for Iqamah Countdown
    if (showingIqamah) {
        countdownEl.classList.remove('countdown-warning');
        countdownEl.classList.remove('countdown-imminent');

        // < 5 mins
        if (diff < 5 * 60 * 1000) {
            countdownEl.classList.add('countdown-warning');
        }
        // < 2 mins (Red alert)
        if (diff < 2 * 60 * 1000) {
            countdownEl.classList.remove('countdown-warning');
            countdownEl.classList.add('countdown-imminent');
        }

    } else {
        countdownEl.classList.remove('countdown-warning');
        countdownEl.classList.remove('countdown-imminent');
    }

    // Highlight active prayer in list
    document.querySelectorAll('.prayer-item').forEach(item => {
        item.classList.remove('active');
        // Highlight the prayer related to the countdown
        // If we are showing "Fajr Iqamah", highlight Fajr
        // If we are showing "Fajr" (next), highlight Fajr? Or just leave it?
        // Let's highlight the Next/Current prayer
        const prayerNameInStatus = statusText.split(' ')[0]; // "Fajr" or "Fajr Iqamah" -> "Fajr"
        if (item.id === `prayer-${prayerNameInStatus}`) {
            item.classList.add('active');
        }
    });

    // Check for Azan Trigger (only if we are targeting Azan, not Iqamah)
    if (!showingIqamah && diff <= 1000 && diff > 0 && azanEnabled) {
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
    tickerInput.value = tickerText;

    // Populate Calculation Settings
    document.getElementById('calc-method').value = calcMethod;
    document.getElementById('asr-method').value = asrMethod;

    // Populate Adjustments
    document.getElementById('adj-Fajr').value = timeAdjustments.Fajr || 0;
    document.getElementById('adj-Dhuhr').value = timeAdjustments.Dhuhr || 0;
    document.getElementById('adj-Asr').value = timeAdjustments.Asr || 0;
    document.getElementById('adj-Maghrib').value = timeAdjustments.Maghrib || 0;
    document.getElementById('adj-Isha').value = timeAdjustments.Isha || 0;

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

        // Save Ticker
        tickerText = tickerInput.value.trim() || DEFAULT_TICKER;
        localStorage.setItem('masjid_ticker', tickerText);
        tickerContentEl.textContent = tickerText;

        // Save Calculation Settings
        calcMethod = document.getElementById('calc-method').value;
        asrMethod = document.getElementById('asr-method').value;
        localStorage.setItem('masjid_calc_method', calcMethod);
        localStorage.setItem('masjid_asr_method', asrMethod);

        // Save Adjustments
        timeAdjustments = {
            Fajr: parseInt(document.getElementById('adj-Fajr').value) || 0,
            Dhuhr: parseInt(document.getElementById('adj-Dhuhr').value) || 0,
            Asr: parseInt(document.getElementById('adj-Asr').value) || 0,
            Maghrib: parseInt(document.getElementById('adj-Maghrib').value) || 0,
            Isha: parseInt(document.getElementById('adj-Isha').value) || 0
        };
        localStorage.setItem('masjid_adjustments', JSON.stringify(timeAdjustments));

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

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

// Run
init();
