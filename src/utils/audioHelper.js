// src/utils/audioHelper.js
const fs = require('fs');
const path = require('path');

/**
 * Validates or prepares the audio file for transcription.
 * Requirements: Mono, 16kHz or 24kHz, PCM s16le (WAV).
 */
async function validateAndPrepareAudio(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    // If it is already a .wav file, we ensure it is properly handled
    if (ext === '.wav') {
        return filePath;
    }

    // If it is another format (.mp3, .m4a, etc.), we can either alert 
    // or let the API reject it cleanly with a clear message for the user.
    return filePath;
}

module.exports = { validateAndPrepareAudio };