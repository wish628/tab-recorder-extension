# Screenshot Capture Guide

Follow these steps to capture professional screenshots for your GitHub repository.

## Required Screenshots

### 1. Popup Launcher (`popup.png`)
**What to capture:**
- Click the extension icon in Chrome toolbar
- Capture the popup window that appears
- Should show: "Start Recording" button and instructions

**Steps:**
1. Open Chrome
2. Click the Screen Recorder extension icon
3. Use Windows Snipping Tool (`Win + Shift + S`)
4. Capture the popup window
5. Save as `screenshots/popup.png`

---

### 2. Recorder Window (`recorder-window.png`)
**What to capture:**
- The recorder window in "Ready to Record" state
- Should show: Title, status badge, Auto-Save toggle, REC/STOP buttons

**Steps:**
1. Click "Start Recording" from popup
2. Recorder window opens
3. Use Snipping Tool to capture the window
4. Save as `screenshots/recorder-window.png`

---

### 3. Recording in Progress (`recording-active.png`)
**What to capture:**
- Recorder window while recording
- Should show: Orange "Recording..." status badge, disabled REC button, enabled STOP button

**Steps:**
1. Click REC button
2. Select a screen/window to record
3. Click Share
4. Quickly restore the recorder window from taskbar
5. Capture the window showing "Recording..." status
6. Save as `screenshots/recording-active.png`

---

### 4. Auto-Save Toggle (`toggle-feature.png`)
**What to capture:**
- Close-up of the Auto-Save toggle switch
- Show both ON and OFF states if possible

**Steps:**
1. Open recorder window
2. Zoom in or crop to show the toggle clearly
3. Capture with toggle ON (purple)
4. Save as `screenshots/toggle-on.png`
5. Toggle OFF and capture (gray)
6. Save as `screenshots/toggle-off.png`

---

## Screenshot Specifications

- **Format:** PNG (for transparency and quality)
- **Size:** Recommended 1280x800 or actual window size
- **Quality:** High resolution, clear text
- **Background:** Clean, no clutter
- **File size:** Keep under 500KB each

## After Capturing

Once you have all screenshots:

1. Create `screenshots` folder:
   ```bash
   mkdir screenshots
   ```

2. Move all PNG files to the folder

3. Verify files:
   ```bash
   ls screenshots/
   ```

4. Run the update script (I'll create this for you)

## Tips for Better Screenshots

- Use a clean desktop background
- Close unnecessary windows
- Ensure good contrast
- Capture at 100% zoom (no browser zoom)
- Use Windows Snipping Tool for precision
- Take multiple shots and choose the best

---

**Ready?** Start with screenshot #1 (popup.png) and work your way through the list!
