/**
 * Echoes of the Past: Scarborough's Lost Aquarium
 * Main application entry point
 */

import { ROOMS } from './utils/constants.js';
import { AudioPlayer } from './audio/AudioPlayer.js';
import { HRTFLoader } from './audio/HRTFLoader.js';
import { Lightbox } from './ui/Lightbox.js';

class Application {
    constructor() {
        this.audioContext = null;
        this.hrtfLoader = null;
        this.players = {};
        this.lightbox = null;
    }

    async init() {
        // Initialize audio context
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

        // Initialize HRTF loader (singleton for all players)
        this.hrtfLoader = new HRTFLoader(this.audioContext);

        // Initialize lightbox
        this.lightbox = new Lightbox();

        // Initialize audio players for each location
        this._initializePlayers();

        console.log('Application initialized');
    }

    _initializePlayers() {
        const locationContainers = document.querySelectorAll('.location');

        locationContainers.forEach(location => {
            const roomId = parseInt(location.getAttribute('data-room'));
            const room = ROOMS[roomId];

            if (!room) {
                console.warn(`No room data found for room ${roomId}`);
                return;
            }

            // Create player with callbacks
            this.players[roomId] = new AudioPlayer(
                roomId,
                room,
                location,
                this.audioContext,
                this.hrtfLoader,
                (completedRoomId) => this._handleAutoplay(completedRoomId),
                (startingRoomId) => this._stopAllPlayersExcept(startingRoomId)
            );

            console.log(`Player initialized for: ${room.title}`);
        });
    }

    _handleAutoplay(completedRoomId) {
        const nextRoomId = completedRoomId + 1;

        if (!this.players[nextRoomId]) {
            console.log('No more rooms to autoplay');
            return;
        }

        console.log(`Autoplaying room ${nextRoomId}`);

        // Stop all other players
        this._stopAllPlayersExcept(nextRoomId);

        // Scroll to next section
        const nextLocation = document.querySelector(`[data-room="${nextRoomId}"]`);
        if (nextLocation) {
            nextLocation.scrollIntoView({ behavior: 'smooth', block: 'start' });

            // Start playing after scroll
            setTimeout(async () => {
                try {
                    await this.players[nextRoomId].togglePlayPause();
                    console.log(`Successfully started room ${nextRoomId}`);
                } catch (error) {
                    console.error(`Error autoplaying room ${nextRoomId}:`, error);
                }
            }, 800);
        }
    }

    _stopAllPlayersExcept(exceptRoomId) {
        Object.keys(this.players).forEach(roomId => {
            if (parseInt(roomId) !== exceptRoomId) {
                this.players[roomId].stop();
            }
        });
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    const app = new Application();
    await app.init();
});
