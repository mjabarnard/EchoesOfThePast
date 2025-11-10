/**
 * Application constants
 */

// Audio Configuration
export const AMBISONIC_ORDER = 1; // First-order ambisonics (4 channels)
export const AUDIO_BUFFER_SIZE = 4096;
export const DEFAULT_VOLUME = 100; // Percentage

// HRTF Configuration
export const HRTF_PATH = 'assets/HRTF/MIT_KEMAR_normal_pinna.sofa.json';

// Timing Constants (milliseconds)
export const AUTOPLAY_DELAY = 800;
export const DOUBLE_TAP_THRESHOLD = 300;

// UI Constants
export const ROTATION_SENSITIVITY = 1; // degrees per pixel of mouse movement

// Room Data
export const ROOMS = {
    1: {
        title: "Entrance Court",
        ambisonicAudio: "assets/part1/1-Entrance Court-o1a.opus",
        narrationAudio: "assets/part1/1-EntranceCourt-VoG.opus"
    },
    2: {
        title: "Central Arcade",
        ambisonicAudio: "assets/part2/2-CentralCourt-o1a.opus",
        narrationAudio: null
    },
    3: {
        title: "The Stage",
        ambisonicAudio: "assets/part3/3-StageFernery-o1a.opus",
        narrationAudio: null
    },
    4: {
        title: "Underwater Feats",
        ambisonicAudio: "assets/part4/4-UnderwaterFeats-o1a.opus",
        narrationAudio: "assets/part4/4-UnderwaterFeats-VoG.opus"
    },
    5: {
        title: "The Grotto",
        ambisonicAudio: "assets/part5/5-Grotto-o1a.opus",
        narrationAudio: "assets/part5/5-Grotto-VoG.opus"
    }
};

// Lightbox Image Selectors
export const LIGHTBOX_IMAGE_SELECTORS = '.main-image, .thumbnail-image, .collage-map img, .collage-grid img';
