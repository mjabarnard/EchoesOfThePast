/**
 * Ambisonic Decoder Module
 * Manages JSAmbisonics decoder and scene rotation
 */

import { AMBISONIC_ORDER } from '../utils/constants.js';

export class AmbisonicDecoder {
    constructor(audioContext, audioBuffer, hrtfLoader) {
        this.audioContext = audioContext;
        this.audioBuffer = audioBuffer;
        this.hrtfLoader = hrtfLoader;
        this.sceneRotator = null;
        this.binDecoder = null;
    }

    /**
     * Create and configure the ambisonic decoder chain
     * Returns a node-like object with input/output for audio graph connection
     */
    async create() {
        const channels = this.audioBuffer.numberOfChannels;

        if (channels !== 4 && channels !== 9 && channels !== 16) {
            throw new Error(`Unsupported channel count: ${channels}. Expected 4 (FOA), 9 (2nd-order), or 16 (3rd-order).`);
        }

        const order = Math.sqrt(channels) - 1;
        console.log(`Creating ambisonic decoder: order ${order}, ${channels} channels`);

        // Create JSAmbisonics components
        this.sceneRotator = new ambisonics.sceneRotator(this.audioContext, order);
        this.binDecoder = new ambisonics.binDecoder(this.audioContext, order);

        // Load and apply HRTF filters
        try {
            const filters = await this.hrtfLoader.load();
            this.binDecoder.updateFilters(filters);
            console.log('Applied SOFA HRTF filters to decoder');
        } catch (error) {
            console.warn('Failed to load SOFA HRTFs, using default filters:', error);
        }

        // Connect rotator to decoder
        this.sceneRotator.out.connect(this.binDecoder.in);

        // Initialize rotation
        this.setRotation(0, 0, 0);

        console.log('Ambisonic decoder created successfully');

        return this._createNodeInterface();
    }

    /**
     * Update scene rotation
     */
    setRotation(yaw, pitch = 0, roll = 0) {
        if (this.sceneRotator) {
            this.sceneRotator.yaw = yaw;
            this.sceneRotator.pitch = pitch;
            this.sceneRotator.roll = roll;
            this.sceneRotator.updateRotMtx();
        }
    }

    /**
     * Create a Web Audio node-like interface for compatibility
     */
    _createNodeInterface() {
        const self = this;
        return {
            input: self.sceneRotator.in,
            output: self.binDecoder.out,
            connect(destination) {
                self.binDecoder.out.connect(destination);
            },
            disconnect() {
                try {
                    if (self.sceneRotator) {
                        self.sceneRotator.in.disconnect();
                        self.sceneRotator.out.disconnect();
                    }
                    if (self.binDecoder) {
                        self.binDecoder.in.disconnect();
                        self.binDecoder.out.disconnect();
                    }
                } catch (e) {
                    console.warn('Error disconnecting decoder:', e);
                }
            }
        };
    }

    /**
     * Cleanup decoder resources
     */
    destroy() {
        this.sceneRotator = null;
        this.binDecoder = null;
    }
}
