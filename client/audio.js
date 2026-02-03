// Pixel-themed 8-bit sound system using Web Audio API
// No external files needed - all sounds generated programmatically

let audioCtx = null;
let soundEnabled = false;
let masterVolume = 0.05; // Lower default volume for less jarring audio

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

// Toggle sound on/off
function toggle() {
  if (!audioCtx) {
    initAudio();
  } else {
    soundEnabled = !soundEnabled;
  }
  return soundEnabled;
}

// Set master volume (0.0 to 1.0)
function setVolume(vol) {
  masterVolume = Math.max(0, Math.min(1, vol));
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

// Check if sound is enabled
function isEnabled() {
  return soundEnabled;
}

// Export global interface
window.gameAudio = {
  initAudio,
  playSound,
  toggle,
  setVolume,
  isEnabled
};
