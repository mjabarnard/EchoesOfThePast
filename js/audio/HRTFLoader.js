/**
 * HRTF Loader Module
 * Handles loading and caching of SOFA HRTF filters for binaural rendering
 */

import { HRTF_PATH, AMBISONIC_ORDER } from '../utils/constants.js';

export class HRTFLoader {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.filters = null;
        this.loadingPromise = null;
    }

    /**
     * Load HRTF filters from SOFA JSON file
     * Uses singleton pattern - only loads once, returns cached on subsequent calls
     */
    async load() {
        if (this.filters) {
            return this.filters;
        }

        if (this.loadingPromise) {
            return this.loadingPromise;
        }

        this.loadingPromise = this._loadFromFile();
        return this.loadingPromise;
    }

    async _loadFromFile() {
        try {
            console.log('Loading SOFA HRTF filters...');

            const response = await fetch(HRTF_PATH);
            if (!response.ok) {
                throw new Error(`Failed to load SOFA file: ${response.statusText}`);
            }

            const sofaData = await response.json();
            console.log('SOFA JSON loaded, processing HRIRs...');

            return new Promise((resolve, reject) => {
                const hrirLoader = new ambisonics.HRIRloader_local(
                    this.audioContext,
                    AMBISONIC_ORDER,
                    (filters) => {
                        console.log('HRIR filters loaded successfully');
                        this.filters = filters;
                        resolve(filters);
                    }
                );

                hrirLoader.loadFromJSON(sofaData);
            });

        } catch (error) {
            console.error('Error loading HRIR filters:', error);
            throw error;
        }
    }
}
