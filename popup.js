let recorder, chunks = [];

document.getElementById('rec').onclick = () => {
  // Show pre-recording instructions
  document.getElementById('preRecordingInstructions').classList.remove('hidden');
  document.getElementById('postRecordingInstructions').classList.add('hidden');
  
  // Hide instructions after 10 seconds
  setTimeout(() => {
    document.getElementById('preRecordingInstructions').classList.add('hidden');
  }, 10000);
  
  // Start recording after a short delay to allow user to read instructions
  setTimeout(() => {
    startRecording();
  }, 3000);
};

document.getElementById('stop').onclick = () => {
  stopRecording();
};

// Add a cleanup function
function cleanupPreviousRecording() {
  console.log('Cleaning up previous recording...');
  // Stop any existing recorder
  if (recorder) {
    try {
      console.log('Current recorder state:', recorder.state);
      if (recorder.state !== 'inactive') {
        recorder.stop();
        console.log('Recorder stopped');
      }
    } catch (e) {
      console.log('Error stopping recorder:', e);
    }
    
    // Stop all tracks
    if (recorder.stream) {
      try {
        recorder.stream.getTracks().forEach(track => {
          try {
            console.log('Stopping track:', track.kind);
            track.stop();
          } catch (e) {
            console.log('Error stopping track:', e);
          }
        });
      } catch (e) {
        console.log('Error stopping streams:', e);
      }
    }
  }
  
  // Clear variables
  recorder = null;
  chunks = [];
  console.log('Cleanup complete');
}

// Function to check supported MIME types
function getSupportedMimeType() {
  const mimeTypes = [
    'video/mp4; codecs="avc1.42E01E"',  // MP4 with H.264 video and AAC audio
    'video/mp4; codecs="vp9"',           // MP4 with VP9 video
    'video/mp4',                         // Generic MP4
    'video/webm; codecs="vp8, vorbis"',  // WebM with VP8 video and Vorbis audio
    'video/webm; codecs="vp9, opus"',    // WebM with VP9 video and Opus audio
    'video/webm'                         // Generic WebM
  ];
  
  for (const mimeType of mimeTypes) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      console.log('Supported MIME type:', mimeType);
      return mimeType;
    }
  }
  
  console.log('No preferred MIME type supported, using default');
  return ''; // Use default
}

// Function to get file extension based on MIME type
function getFileExtension(mimeType) {
  if (mimeType.startsWith('video/mp4')) {
    return '.mp4';
  } else if (mimeType.startsWith('video/webm')) {
    return '.webm';
  } else {
    // Default to mp4 for better compatibility
    return '.mp4';
  }
}

async function startRecording() {
  try {
    console.log('=== STARTING SCREEN RECORDING PROCESS ===');
    
    // Show post-recording instructions
    document.getElementById('preRecordingInstructions').classList.add('hidden');
    document.getElementById('postRecordingInstructions').classList.remove('hidden');
    
    // Always cleanup first
    cleanupPreviousRecording();
    
    // Disable the record button and enable stop button
    document.getElementById('rec').disabled = true;
    document.getElementById('stop').disabled = false;
    console.log('UI buttons updated');
    
    // Request desktop capture
    console.log('Requesting desktop capture...');
    
    // Use chrome.desktopCapture to capture the entire screen
    const streamId = await new Promise((resolve, reject) => {
      chrome.desktopCapture.chooseDesktopMedia(
        ['screen', 'window', 'tab'],  // Sources to capture
        (streamId, options) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (!streamId) {
            reject(new Error('No stream ID returned - user cancelled selection'));
          } else {
            console.log('Desktop capture stream ID received:', streamId);
            console.log('Capture options:', options);
            resolve(streamId);
          }
        }
      );
    });
    
    // Get the media stream using the stream ID
    const constraints = {
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: streamId,
          maxWidth: 1920,
          maxHeight: 1080,
          maxFrameRate: 30
        }
      },
      audio: false  // We'll get audio separately
    };
    
    console.log('Getting desktop media stream with constraints:', constraints);
    const screenStream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log('Screen stream captured successfully:', screenStream);
    
    // Ask for microphone permission separately
    console.log('Requesting microphone access...');
    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    console.log('Microphone stream captured successfully:', micStream);
    
    // Merge audio streams
    console.log('Merging audio streams...');
    const audioCtx = new AudioContext();
    const dest = audioCtx.createMediaStreamDestination();
    
    // Connect microphone audio to destination
    if (micStream.getAudioTracks().length > 0) {
      const micAudioSource = audioCtx.createMediaStreamSource(micStream);
      micAudioSource.connect(dest);
      console.log('Connected microphone audio to destination');
    }
    
    // Create final stream with screen video and merged audio
    const videoTracks = screenStream.getVideoTracks();
    const audioTracks = dest.stream.getAudioTracks();
    
    console.log('Video tracks:', videoTracks.length);
    console.log('Audio tracks:', audioTracks.length);
    
    const mixedStream = new MediaStream([
      ...videoTracks,
      ...audioTracks
    ]);
    
    console.log('Mixed stream created with total tracks:', mixedStream.getTracks().length);
    
    console.log('Initializing MediaRecorder...');
    // Check for supported MIME type (prefer MP4 for better compatibility)
    const mimeType = getSupportedMimeType();
    const fileExtension = getFileExtension(mimeType);
    
    // Start recording with the best supported format
    const recorderOptions = mimeType ? { mimeType: mimeType } : {};
    recorder = new MediaRecorder(mixedStream, recorderOptions);
    chunks = [];
    
    console.log('MediaRecorder state:', recorder.state);
    console.log('Using MIME type:', mimeType || 'default');
    console.log('File extension:', fileExtension);
    
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
        console.log('Chunk received, size:', event.data.size, 'bytes. Total chunks:', chunks.length);
      } else {
        console.log('Empty chunk received');
      }
    };
    
    recorder.onstop = () => {
      console.log('=== RECORDER STOPPED ===');
      console.log('Total chunks collected:', chunks.length);
      
      // Stop all tracks when recording stops
      screenStream.getTracks().forEach(track => track.stop());
      micStream.getTracks().forEach(track => track.stop());
      
      if (chunks.length > 0 && chunks.reduce((total, chunk) => total + chunk.size, 0) > 0) {
        const blob = new Blob(chunks, { type: mimeType || 'video/mp4' });
        console.log('Blob created, size:', blob.size, 'bytes');
        
        if (blob.size > 0) {
          // Create download link that stays open for user interaction
          const url = URL.createObjectURL(blob);
          const filename = `screen-recording-${Date.now()}${fileExtension}`;
          console.log('Creating download link for file:', filename);
          
          // Create a prominent download link in the popup
          const downloadContainer = document.createElement('div');
          downloadContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            background: #4CAF50;
            color: white;
            padding: 10px;
            text-align: center;
            z-index: 10000;
            font-family: Arial, sans-serif;
          `;
          
          downloadContainer.innerHTML = `
            <strong>Recording Complete!</strong><br>
            <a href="${url}" download="${filename}" 
               style="color: white; font-weight: bold; text-decoration: underline;">
              Click here to download: ${filename}
            </a><br>
            <small>(Right-click and select "Save link as..." to choose location)</small>
          `;
          
          document.body.appendChild(downloadContainer);
          
          // Also show alert to notify user
          alert('Screen recording complete!\n\n' +
                'A download link has appeared at the top of this popup.\n' +
                'Click it or right-click to save to your preferred location.');
          
          console.log('Download link created for user interaction');
        } else {
          console.warn('Blob is empty, not creating download link');
          alert('Recording completed but file is empty. No data was captured.');
        }
      } else {
        console.warn('No data recorded or chunks are empty');
        alert('Recording completed but no data was captured.');
      }
      
      // Cleanup after recording (but keep the download link)
      // Don't cleanup immediately, let user interact with download link first
      setTimeout(() => {
        cleanupPreviousRecording();
      }, 30000); // Cleanup after 30 seconds
      
      // Don't close the popup automatically
      // Let user close it manually after downloading
    };
    
    recorder.start(1000); // Collect data every second
    console.log('Recording started with timeslice: 1000ms');
    console.log('Recorder state after start:', recorder.state);
    
  } catch (error) {
    console.error('=== ERROR STARTING SCREEN RECORDING ===');
    console.error('Error starting recording:', error);
    
    // Hide instructions on error
    document.getElementById('preRecordingInstructions').classList.add('hidden');
    document.getElementById('postRecordingInstructions').classList.add('hidden');
    
    // Cleanup on error
    cleanupPreviousRecording();
    
    // Provide more detailed error message
    let errorMessage = 'Error starting screen recording: ' + error.message + '\n\n';
    
    if (error.message.includes('Permission') || error.message.includes('denied')) {
      errorMessage += 'SCREEN CAPTURE PERMISSIONS NEEDED:\n' +
                     '1. Chrome will show a screen selection dialog\n' +
                     '2. Choose what to share (entire screen, window, or tab)\n' +
                     '3. Click "Share" to allow screen capture\n' +
                     '4. Allow microphone access when prompted\n\n' +
                     'TROUBLESHOOTING:\n' +
                     '- Close all Chrome windows and reopen\n' +
                     '- Try recording again\n' +
                     '- Check Chrome settings: Settings > Privacy > Camera & Microphone\n';
    } else if (error.message.includes('cancelled') || error.message.includes('cancel')) {
      errorMessage += 'RECORDING CANCELLED:\n' +
                     'You cancelled the screen selection.\n' +
                     'To record, you must:\n' +
                     '1. Click REC button\n' +
                     '2. Select what to share (screen/window/tab)\n' +
                     '3. Click "Share"\n' +
                     '4. Allow microphone access\n';
    } else {
      errorMessage += 'Check the console (Ctrl+Shift+J) for detailed error information.\n\n' +
                     'Common issues:\n' +
                     '- Permissions not granted\n' +
                     '- Browser policies blocking screen capture\n' +
                     '- No audio/video content\n' +
                     '- Browser restrictions';
    }
    
    alert(errorMessage);
    
    // Re-enable record button
    document.getElementById('rec').disabled = false;
    document.getElementById('stop').disabled = true;
  }
}

function stopRecording() {
  console.log('=== STOPPING SCREEN RECORDING ===');
  
  // Hide post-recording instructions
  document.getElementById('postRecordingInstructions').classList.add('hidden');
  
  if (recorder && recorder.state !== 'inactive') {
    console.log('Stopping recorder...');
    recorder.stop();
    console.log('Recorder stop command sent');
    
    // Show message that processing is happening
    const processingMsg = document.createElement('div');
    processingMsg.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #2196F3;
      color: white;
      padding: 20px;
      border-radius: 5px;
      z-index: 10001;
      font-family: Arial, sans-serif;
      text-align: center;
    `;
    processingMsg.innerHTML = '<strong>Processing screen recording...</strong><br>Please wait';
    document.body.appendChild(processingMsg);
    
    // Remove processing message after a few seconds
    setTimeout(() => {
      if (processingMsg.parentNode) {
        processingMsg.parentNode.removeChild(processingMsg);
      }
    }, 3000);
  } else {
    console.log('Recorder not active or not initialized');
  }
  
  // Don't cleanup immediately when stopping
  // The onstop handler will handle cleanup
  
  // Re-enable record button
  document.getElementById('rec').disabled = false;
  document.getElementById('stop').disabled = true;
  console.log('UI buttons reset');
}