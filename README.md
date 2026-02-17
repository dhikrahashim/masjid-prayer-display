
# Masjid Prayer Time Display

A simple, beautiful prayer time display for Google TV / Chromecast / Browser.

## Setup & Usage

### 1. Test on your Mac
1. Open Terminal.
2. Navigate to this folder:
   ```bash
   cd /home/USER/hasabd/projects/upgrade/masjid_prayer_display
   ```
3. Start a simple web server:
   ```bash
   python3 -m http.server
   ```
4. Open your browser and go to: `http://localhost:8000`

### 2. Configure Location
1. On the first load, a settings popup will appear.
2. Enter your **City** and **Country** (e.g., `Mecca`, `Saudi Arabia`).
3. Click "Save & Update".
4. The times will load automatically.

### 3. Deploy to Google TV
You have two main options:

**Option A: Host on GitHub Pages (Recommended)**
1. Provide these files to us (or upload to your own GitHub repository).
2. Enable GitHub Pages in the repository settings.
3. Open the GitHub Pages URL in the TV's browser (e.g., Chrome, Puffin TV Browser).

**Option B: USB Drive (Offline)**
1. Copy the `masjid_prayer_display` folder to a USB drive.
2. Plug the USB drive into the TV (if supported).
3. Use a file manager app on the TV to open `index.html`.
*(Note: Some features like local storage might behave differently in file:// mode on some TVs).*

### Features
- **Auto-Refresh**: Updates times automatically.
- **Large Display**: easy to read from a distance.
- **Next Prayer Countdown**: Highlights upcoming prayer.
- **Azan Audio**: Click the "zAzan Off" button to enable audio. (Browser policy requires interaction first).

## Customization
- To change colors or fonts, edit `style.css`.
- To change the Azan audio, update the `src` in `index.html`.
