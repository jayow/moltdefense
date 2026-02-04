// Pixel-themed 8-bit sound system using Web Audio API
// No external files needed - all sounds generated programmatically

let audioCtx = null;
let soundEnabled = false;
let masterVolume = 0.05; // Lower default volume for less jarring audio

// Background music state
let musicEnabled = false;
let musicGainNode = null;
let musicInterval = null;
let musicVolume = 0.3; // Music is quieter relative to master

// 8-bit chiptune melody pattern - relaxed tower defense vibe
const MUSIC_PATTERN = {
  // Main melody (triangle wave) - pentatonic scale for pleasant looping
  melody: [
    { freq: 330, dur: 0.4 },   // E4
    { freq: 392, dur: 0.4 },   // G4
    { freq: 440, dur: 0.4 },   // A4
    { freq: 523, dur: 0.8 },   // C5
    { freq: 440, dur: 0.4 },   // A4
    { freq: 392, dur: 0.4 },   // G4
    { freq: 330, dur: 0.8 },   // E4
    { freq: 294, dur: 0.4 },   // D4
    { freq: 330, dur: 0.4 },   // E4
    { freq: 392, dur: 0.8 },   // G4
    { freq: 330, dur: 0.4 },   // E4
    { freq: 294, dur: 0.4 },   // D4
    { freq: 262, dur: 0.8 },   // C4
  ],
  // Bass line (square wave at low octave)
  bass: [
    { freq: 131, dur: 0.8 },   // C3
    { freq: 131, dur: 0.8 },   // C3
    { freq: 165, dur: 0.8 },   // E3
    { freq: 165, dur: 0.8 },   // E3
    { freq: 147, dur: 0.8 },   // D3
    { freq: 147, dur: 0.8 },   // D3
    { freq: 131, dur: 0.8 },   // C3
    { freq: 131, dur: 0.8 },   // C3
  ],
  loopDuration: 6.4  // Total loop time in seconds
};

// Rate limiting for frequent sounds
let lastShootTime = 0;
let lastKillTime = 0;
const SHOOT_COOLDOWN = 120; // Only play shoot sound every 120ms max
const KILL_COOLDOWN = 150; // Only play kill sound every 150ms max

// Initialize audio context (must be called from user interaction)
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume context if suspended (browser autoplay policy)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  soundEnabled = true;
  return true;
}

// Toggle sound effects on/off (separate from music)
function toggleSound() {
  if (!audioCtx) {
    initAudio();
  }
  soundEnabled = !soundEnabled;
  return soundEnabled;
}

// Toggle music on/off (separate from sound effects)
function toggleMusic() {
  if (!audioCtx) {
    initAudio();
  }
  if (musicEnabled) {
    stopMusic();
  } else {
    startMusic();
  }
  return musicEnabled;
}

// Legacy toggle function - toggles both for backwards compatibility
function toggle() {
  if (!audioCtx) {
    initAudio();
  }
  // Toggle both together
  soundEnabled = !soundEnabled;
  if (soundEnabled) {
    startMusic();
  } else {
    stopMusic();
  }
  return soundEnabled;
}

// Set master volume (0.0 to 1.0)
function setVolume(vol) {
  masterVolume = Math.max(0, Math.min(1, vol));
  updateMusicVolume();
}

// Play a sound effect
function playSound(type) {
  if (!soundEnabled || !audioCtx) return;

  // Ensure context is running
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const now = audioCtx.currentTime;

  // Rate limit frequent sounds to avoid audio spam
  const currentTime = performance.now();
  if (type === 'shoot') {
    if (currentTime - lastShootTime < SHOOT_COOLDOWN) {
      return; // Skip this sound
    }
    lastShootTime = currentTime;
  }
  if (type === 'kill') {
    if (currentTime - lastKillTime < KILL_COOLDOWN) {
      return; // Skip this sound
    }
    lastKillTime = currentTime;
  }

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  switch(type) {
    case 'shoot':
    case 'shoot_basic':
      // Very soft blip - using sine wave with lower pitch
      osc.type = 'sine';
      // Lower pitch range for more pleasant sound
      const shootPitch = 400 + Math.random() * 100;
      osc.frequency.setValueAtTime(shootPitch, now);
      osc.frequency.exponentialRampToValueAtTime(shootPitch * 0.6, now + 0.025);
      gain.gain.setValueAtTime(masterVolume * 0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
      osc.start(now);
      osc.stop(now + 0.025);
      break;

    case 'shoot_slow':
      // Frost/ice sound - high pitched crystalline shimmer
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.06);
      gain.gain.setValueAtTime(masterVolume * 0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.start(now);
      osc.stop(now + 0.06);
      // Add secondary shimmer
      playShimmer(now, 1400, 0.03);
      break;

    case 'shoot_burst':
      // Fire/explosion - deep boom with crackle
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.08);
      gain.gain.setValueAtTime(masterVolume * 0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
      break;

    case 'shoot_chain':
      // Electric zap - buzzy square wave
      osc.type = 'square';
      osc.frequency.setValueAtTime(800 + Math.random() * 400, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.04);
      gain.gain.setValueAtTime(masterVolume * 0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.start(now);
      osc.stop(now + 0.04);
      break;

    case 'shoot_sniper':
      // Arrow/laser - sharp whistle with trail
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.linearRampToValueAtTime(1200, now + 0.02);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.08);
      gain.gain.setValueAtTime(masterVolume * 0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
      break;

    case 'shoot_support':
      // Magical buff - gentle chime
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523, now); // C5
      osc.frequency.setValueAtTime(659, now + 0.03); // E5
      gain.gain.setValueAtTime(masterVolume * 0.15, now);
      gain.gain.setValueAtTime(masterVolume * 0.12, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.start(now);
      osc.stop(now + 0.06);
      break;

    case 'hit':
      // Soft thud for damage hit
      osc.type = 'sine';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.06);
      gain.gain.setValueAtTime(masterVolume * 0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.start(now);
      osc.stop(now + 0.06);
      break;

    case 'kill':
      // Soft pleasant ascending tone for enemy kill
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(330, now);
      osc.frequency.linearRampToValueAtTime(440, now + 0.05);
      osc.frequency.linearRampToValueAtTime(550, now + 0.08);
      gain.gain.setValueAtTime(masterVolume * 0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.start(now);
      osc.stop(now + 0.09);
      break;

    case 'leak':
      // Soft descending tone for enemy leak
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(250, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.12);
      gain.gain.setValueAtTime(masterVolume * 0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
      break;

    case 'wave':
      // Soft chime for wave start
      osc.type = 'sine';
      osc.frequency.setValueAtTime(392, now); // G4
      osc.frequency.setValueAtTime(494, now + 0.07); // B4
      osc.frequency.setValueAtTime(587, now + 0.14); // D5
      gain.gain.setValueAtTime(masterVolume * 0.35, now);
      gain.gain.setValueAtTime(masterVolume * 0.3, now + 0.07);
      gain.gain.setValueAtTime(masterVolume * 0.25, now + 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
      break;

    case 'spawn':
      // Very soft pop for enemy spawn
      osc.type = 'sine';
      osc.frequency.setValueAtTime(350, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.03);
      gain.gain.setValueAtTime(masterVolume * 0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
      osc.start(now);
      osc.stop(now + 0.03);
      break;

    case 'victory':
      // Triumphant ascending arpeggio
      playArpeggio([523, 659, 784, 1047], 0.1, 'triangle');
      break;

    case 'defeat':
      // Gentle descending arpeggio
      playArpeggio([392, 330, 262, 196], 0.12, 'triangle');
      break;

    default:
      // Skip unknown sound types
      return;
  }
}

// Play an arpeggio (sequence of notes)
function playArpeggio(frequencies, noteDuration, waveType) {
  if (!soundEnabled || !audioCtx) return;

  frequencies.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const startTime = audioCtx.currentTime + (i * noteDuration);

    osc.type = waveType || 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(masterVolume * 0.5, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + noteDuration * 0.9);

    osc.start(startTime);
    osc.stop(startTime + noteDuration);
  });
}

// Play a shimmer effect (for frost/ice sounds)
function playShimmer(startTime, freq, duration) {
  if (!soundEnabled || !audioCtx) return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, startTime);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.7, startTime + duration);
  gain.gain.setValueAtTime(masterVolume * 0.1, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.start(startTime);
  osc.stop(startTime + duration);
}

// Check if sound is enabled
function isEnabled() {
  return soundEnabled;
}

// Get current volume (0-1)
function getVolume() {
  return masterVolume;
}

// Start background music loop
function startMusic() {
  if (!audioCtx || musicEnabled) return;

  musicEnabled = true;
  musicGainNode = audioCtx.createGain();
  musicGainNode.connect(audioCtx.destination);
  musicGainNode.gain.setValueAtTime(masterVolume * musicVolume, audioCtx.currentTime);

  // Play the music pattern on loop
  function playMusicLoop() {
    if (!musicEnabled || !audioCtx) return;

    const startTime = audioCtx.currentTime;

    // Play melody
    let melodyTime = 0;
    MUSIC_PATTERN.melody.forEach(note => {
      playMusicNote(note.freq, startTime + melodyTime, note.dur, 'triangle', 0.15);
      melodyTime += note.dur;
    });

    // Play bass
    let bassTime = 0;
    MUSIC_PATTERN.bass.forEach(note => {
      playMusicNote(note.freq, startTime + bassTime, note.dur, 'square', 0.08);
      bassTime += note.dur;
    });

    // Schedule next loop
    musicInterval = setTimeout(playMusicLoop, MUSIC_PATTERN.loopDuration * 1000);
  }

  playMusicLoop();
}

// Play a single music note
function playMusicNote(freq, startTime, duration, waveType, volume) {
  if (!audioCtx || !musicEnabled) return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.connect(gain);
  gain.connect(musicGainNode);

  osc.type = waveType;
  osc.frequency.setValueAtTime(freq, startTime);

  // Gentle envelope for smoother sound
  const attackTime = 0.02;
  const releaseTime = 0.05;
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + attackTime);
  gain.gain.setValueAtTime(volume, startTime + duration - releaseTime);
  gain.gain.linearRampToValueAtTime(0, startTime + duration);

  osc.start(startTime);
  osc.stop(startTime + duration);
}

// Stop background music
function stopMusic() {
  musicEnabled = false;
  if (musicInterval) {
    clearTimeout(musicInterval);
    musicInterval = null;
  }
  if (musicGainNode) {
    musicGainNode.gain.setValueAtTime(0, audioCtx?.currentTime || 0);
    musicGainNode = null;
  }
}

// Update music volume when master volume changes
function updateMusicVolume() {
  if (musicGainNode && audioCtx) {
    musicGainNode.gain.setValueAtTime(masterVolume * musicVolume, audioCtx.currentTime);
  }
}

// Check if music is enabled
function isMusicEnabled() {
  return musicEnabled;
}

// Export global interface
window.gameAudio = {
  initAudio,
  playSound,
  toggle,           // Legacy: toggles both
  toggleSound,      // Toggle sound FX only
  toggleMusic,      // Toggle music only
  setVolume,
  isEnabled,        // Sound FX enabled?
  isMusicEnabled,   // Music enabled?
  getVolume,
  startMusic,
  stopMusic
};
