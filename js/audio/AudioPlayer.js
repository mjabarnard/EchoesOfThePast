/**
 * AudioPlayer Module
 * Handles ambisonic audio playback with narration
 */

import { AmbisonicDecoder } from './AmbisonicDecoder.js';
import { RotaryControl } from '../ui/RotaryControl.js';
import { DEFAULT_VOLUME, AUTOPLAY_DELAY } from '../utils/constants.js';

export class AudioPlayer {
    constructor(roomId, room, container, audioContext, hrtfLoader, onComplete, onPlayStart) {
        this.roomId = roomId;
        this.room = room;
        this.container = container;
        this.audioContext = audioContext;
        this.hrtfLoader = hrtfLoader;
        this.onComplete = onComplete; // Callback when playback completes
        this.onPlayStart = onPlayStart; // Callback when playback starts

        // Audio state
        this.ambisonicBuffer = null;
        this.narrationBuffer = null;
        this.ambisonicSource = null;
        this.narrationSource = null;
        this.ambisonicGain = null;
        this.narrationGain = null;
        this.decoder = null;
        this.decoderFactory = null; // Keep reference to AmbisonicDecoder instance

        // Playback state
        this.isPlaying = false;
        this.isPaused = false;
        this.startTime = 0;
        this.pauseTime = 0;
        this.animationFrame = null;

        // UI elements
        this.playBtn = container.querySelector('.play-btn');
        this.audioStatus = container.querySelector('.audio-status');
        this.seekSlider = container.querySelector('.seek-slider');
        this.currentTimeEl = container.querySelector('.current-time');
        this.durationEl = container.querySelector('.duration');
        this.soundscapeVolumeSlider = container.querySelector('.soundscape-volume-slider');
        this.narrationVolumeSlider = container.querySelector('.narration-volume-slider');

        // Rotary control
        this.rotaryControl = new RotaryControl(
            container,
            (rotation) => this._handleRotationChange(rotation)
        );

        this.audioLoaded = false;

        this._bindEvents();
    }

    _bindEvents() {
        this.playBtn.addEventListener('click', () => this.togglePlayPause());
        this.seekSlider.addEventListener('change', async (e) => await this._handleSeek(e));
        this.seekSlider.addEventListener('input', (e) => this._updateSeekDisplay(e));
        this.seekSlider.addEventListener('click', (e) => this._handleSeekClick(e));
        this.soundscapeVolumeSlider.addEventListener('input', (e) => this._handleSoundscapeVolume(e));
        this.narrationVolumeSlider.addEventListener('input', (e) => this._handleNarrationVolume(e));
    }

    async togglePlayPause() {
        try {
            if (this.isPlaying && !this.isPaused) {
                this.pause();
            } else if (this.isPaused) {
                await this.resume();
            } else {
                await this._loadAndPlay();
            }
        } catch (error) {
            console.error('Error toggling playback:', error);
            this.audioStatus.textContent = 'Error: ' + error.message;
        }
    }

    async _loadAndPlay() {
        if (!this.audioLoaded) {
            await this._loadAudio();
        }
        await this.play();
    }

    async _loadAudio() {
        try {
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            this.audioStatus.textContent = 'Loading audio files...';

            // Load ambisonic audio
            const ambisonicResponse = await fetch(this.room.ambisonicAudio);
            if (!ambisonicResponse.ok) {
                throw new Error(`Failed to load ${this.room.ambisonicAudio}: ${ambisonicResponse.statusText}`);
            }

            const ambisonicData = await ambisonicResponse.arrayBuffer();
            this.ambisonicBuffer = await this.audioContext.decodeAudioData(ambisonicData);

            // Load narration if available
            if (this.room.narrationAudio) {
                const narrationResponse = await fetch(this.room.narrationAudio);
                if (!narrationResponse.ok) {
                    throw new Error(`Failed to load ${this.room.narrationAudio}`);
                }
                const narrationData = await narrationResponse.arrayBuffer();
                this.narrationBuffer = await this.audioContext.decodeAudioData(narrationData);
            }

            // Update UI
            const duration = this.ambisonicBuffer.duration;
            this.durationEl.textContent = this._formatTime(duration);
            this.seekSlider.max = duration;

            this.audioLoaded = true;
            this.audioStatus.textContent = 'Ready';

            console.log(`Audio loaded for room ${this.roomId}: ${this.ambisonicBuffer.numberOfChannels} channels`);

        } catch (error) {
            console.error('Error loading audio:', error);
            this.audioStatus.textContent = 'Error loading audio';
            throw error;
        }
    }

    async play() {
        if (!this.ambisonicBuffer) {
            throw new Error('No audio buffer loaded');
        }

        // Stop other players
        if (this.onPlayStart) {
            this.onPlayStart(this.roomId);
        }

        this._cleanup();

        // Create gain nodes
        // Apply 3dB boost to ambisonic (3dB = 10^(3/20) ≈ 1.413)
        this.ambisonicGain = this.audioContext.createGain();
        const soundscapeVolume = this.soundscapeVolumeSlider.value / 100;
        this.ambisonicGain.gain.value = soundscapeVolume * 1.413;

        if (this.narrationBuffer) {
            this.narrationGain = this.audioContext.createGain();
            this.narrationGain.gain.value = this.narrationVolumeSlider.value / 100;
        }

        // Create and start sources
        await this._createSources(0);

        this.isPlaying = true;
        this.isPaused = false;
        this.playBtn.querySelector('.play-icon').textContent = '⏸';
        this.audioStatus.textContent = 'Playing';

        this._updateTime();
    }

    async pause() {
        const currentTime = this.audioContext.currentTime - this.startTime;
        this.pauseTime = Math.min(currentTime, this.ambisonicBuffer.duration);

        // Stop sources
        this._stopSources();

        // Disconnect decoder
        if (this.decoder) {
            this.decoder.disconnect();
            this.decoder = null;
        }

        // Disconnect gains but keep them
        if (this.ambisonicGain) this.ambisonicGain.disconnect();
        if (this.narrationGain) this.narrationGain.disconnect();

        this.isPaused = true;
        this.playBtn.querySelector('.play-icon').textContent = '▶';
        this.audioStatus.textContent = 'Paused';

        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
    }

    async resume() {
        if (!this.isPaused) return;

        // Reconnect gains
        if (this.ambisonicGain) {
            this.ambisonicGain.connect(this.audioContext.destination);
        }
        if (this.narrationGain) {
            this.narrationGain.connect(this.audioContext.destination);
        }

        // Recreate sources from pause point
        await this._createSources(this.pauseTime);

        this.isPaused = false;
        this.playBtn.querySelector('.play-icon').textContent = '⏸';
        this.audioStatus.textContent = 'Playing';

        this._updateTime();
    }

    stop() {
        this._cleanup();

        this.isPlaying = false;
        this.isPaused = false;
        this.startTime = 0;
        this.pauseTime = 0;

        this.playBtn.querySelector('.play-icon').textContent = '▶';
        this.audioStatus.textContent = 'Stopped';
        this.currentTimeEl.textContent = '0:00';
        this.seekSlider.value = 0;

        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
    }

    async _createSources(startTime) {
        // Create ambisonic source
        this.ambisonicSource = this.audioContext.createBufferSource();
        this.ambisonicSource.buffer = this.ambisonicBuffer;

        // Create decoder
        this.decoderFactory = new AmbisonicDecoder(
            this.audioContext,
            this.ambisonicBuffer,
            this.hrtfLoader
        );
        this.decoder = await this.decoderFactory.create();

        // Apply current rotation
        this.decoderFactory.setRotation(this.rotaryControl.getRotation());

        // Connect audio graph
        this.ambisonicSource.connect(this.decoder.input);
        this.decoder.connect(this.ambisonicGain);
        this.ambisonicGain.connect(this.audioContext.destination);

        // Create narration source if available
        if (this.narrationBuffer) {
            this.narrationSource = this.audioContext.createBufferSource();
            this.narrationSource.buffer = this.narrationBuffer;
            this.narrationSource.connect(this.narrationGain);
            this.narrationGain.connect(this.audioContext.destination);
        }

        // Set up onended handler
        this.ambisonicSource.onended = () => this._handlePlaybackComplete();

        // Start playback
        this.startTime = this.audioContext.currentTime - startTime;
        this.ambisonicSource.start(0, startTime);
        if (this.narrationSource) {
            this.narrationSource.start(0, startTime);
        }
    }

    _stopSources() {
        if (this.ambisonicSource) {
            this.ambisonicSource.onended = null;
            try { this.ambisonicSource.stop(); } catch (e) {}
            this.ambisonicSource.disconnect();
            this.ambisonicSource = null;
        }

        if (this.narrationSource) {
            this.narrationSource.onended = null;
            try { this.narrationSource.stop(); } catch (e) {}
            this.narrationSource.disconnect();
            this.narrationSource = null;
        }
    }

    _cleanup() {
        this._stopSources();

        if (this.decoder) {
            this.decoder.disconnect();
            this.decoder = null;
        }

        if (this.decoderFactory) {
            this.decoderFactory.destroy();
            this.decoderFactory = null;
        }

        if (this.ambisonicGain) {
            try { this.ambisonicGain.disconnect(); } catch (e) {}
            this.ambisonicGain = null;
        }

        if (this.narrationGain) {
            try { this.narrationGain.disconnect(); } catch (e) {}
            this.narrationGain = null;
        }
    }

    _handlePlaybackComplete() {
        if (this.isPlaying && !this.isPaused) {
            this.stop();
            this.audioStatus.textContent = 'Complete';

            // Trigger autoplay callback
            if (this.onComplete) {
                setTimeout(() => this.onComplete(this.roomId), AUTOPLAY_DELAY);
            }
        }
    }

    async _handleSeek(e) {
        const seekTime = parseFloat(e.target.value);

        if (this.isPlaying || this.isPaused) {
            const wasPlaying = this.isPlaying && !this.isPaused;
            const duration = this.ambisonicBuffer.duration;

            if (seekTime >= duration) {
                this.stop();
                return;
            }

            // Stop current sources
            this._stopSources();
            if (this.decoder) {
                this.decoder.disconnect();
                this.decoder = null;
            }

            this.pauseTime = seekTime;

            if (wasPlaying) {
                // Recreate and restart from new position
                await this._createSources(seekTime);
                this.isPaused = false;
                this._updateTime();
            } else {
                this.currentTimeEl.textContent = this._formatTime(seekTime);
            }
        }

        this.currentTimeEl.textContent = this._formatTime(seekTime);
    }

    _updateSeekDisplay(e) {
        const seekTime = parseFloat(e.target.value);
        this.currentTimeEl.textContent = this._formatTime(seekTime);
    }

    async _handleSeekClick(e) {
        // Prevent default slider behavior to avoid double-seeking
        e.preventDefault();
        e.stopPropagation();

        // Calculate click position relative to slider
        const rect = this.seekSlider.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = clickX / rect.width;

        // Calculate time based on duration
        const duration = parseFloat(this.seekSlider.max);
        const seekTime = percentage * duration;

        // Update slider value
        this.seekSlider.value = seekTime;

        // Trigger seek
        await this._handleSeek({ target: { value: seekTime } });
    }

    _handleSoundscapeVolume(e) {
        const volume = parseFloat(e.target.value) / 100;
        if (this.ambisonicGain) {
            // Apply 3dB boost to ambisonic (3dB = 10^(3/20) ≈ 1.413)
            this.ambisonicGain.gain.value = volume * 1.413;
        }
    }

    _handleNarrationVolume(e) {
        const volume = parseFloat(e.target.value) / 100;
        if (this.narrationGain) {
            this.narrationGain.gain.value = volume;
        }
    }

    _handleRotationChange(rotation) {
        if (this.decoderFactory) {
            this.decoderFactory.setRotation(rotation);
        }
    }

    _updateTime() {
        if (!this.isPlaying || this.isPaused) return;

        const currentTime = this.audioContext.currentTime - this.startTime;
        const duration = this.ambisonicBuffer.duration;

        if (currentTime >= duration) {
            this.currentTimeEl.textContent = this._formatTime(duration);
            this.seekSlider.value = duration;
            if (this.animationFrame) {
                cancelAnimationFrame(this.animationFrame);
                this.animationFrame = null;
            }
            return;
        }

        this.currentTimeEl.textContent = this._formatTime(currentTime);
        this.seekSlider.value = currentTime;

        this.animationFrame = requestAnimationFrame(() => this._updateTime());
    }

    _formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}
