/**
 * Rotary Control UI Module
 * Handles rotary knob interaction for ambisonic scene rotation
 */

import { DOUBLE_TAP_THRESHOLD, ROTATION_SENSITIVITY } from '../utils/constants.js';

export class RotaryControl {
    constructor(container, onRotationChange) {
        this.container = container;
        this.onRotationChange = onRotationChange; // Callback when rotation changes

        this.knob = container.querySelector('.rotary-knob');
        this.indicator = container.querySelector('.rotary-indicator');
        this.valueDisplay = container.querySelector('.rotation-value');

        this.isDragging = false;
        this.lastY = 0;
        this.lastTapTime = 0;
        this.currentRotation = 0;

        this._bindEvents();
        this._updateVisual();
    }

    _bindEvents() {
        // Mouse events
        this.knob.addEventListener('mousedown', (e) => this._startDrag(e));
        this.knob.addEventListener('dblclick', () => this.reset());
        document.addEventListener('mousemove', (e) => this._drag(e));
        document.addEventListener('mouseup', () => this._endDrag());

        // Touch events
        this.knob.addEventListener('touchstart', (e) => this._startDrag(e), { passive: false });
        this.knob.addEventListener('touchend', (e) => this._handleTouchEnd(e), { passive: false });
        document.addEventListener('touchmove', (e) => this._drag(e), { passive: false });
    }

    _startDrag(e) {
        this.isDragging = true;
        e.preventDefault();

        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        this.lastY = clientY;
    }

    _drag(e) {
        if (!this.isDragging) return;
        e.preventDefault();

        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const deltaY = this.lastY - clientY; // Inverted: up = clockwise

        this.currentRotation += deltaY * ROTATION_SENSITIVITY;
        this._updateVisual();

        if (this.onRotationChange) {
            this.onRotationChange(this.currentRotation);
        }

        this.lastY = clientY;
    }

    _endDrag() {
        this.isDragging = false;
    }

    _handleTouchEnd(e) {
        this._endDrag();

        // Double-tap detection for mobile reset
        const currentTime = Date.now();
        const tapTimeDiff = currentTime - this.lastTapTime;

        if (tapTimeDiff < DOUBLE_TAP_THRESHOLD && tapTimeDiff > 0) {
            this.reset();
            e.preventDefault();
        }

        this.lastTapTime = currentTime;
    }

    reset() {
        this.currentRotation = 0;
        this._updateVisual();

        if (this.onRotationChange) {
            this.onRotationChange(this.currentRotation);
        }
    }

    _updateVisual() {
        // Rotate indicator
        this.indicator.style.transform = `translateX(-50%) rotate(${this.currentRotation}deg)`;

        // Normalize display angle to -180 to 180
        let displayAngle = this.currentRotation % 360;
        if (displayAngle > 180) displayAngle -= 360;
        if (displayAngle < -180) displayAngle += 360;

        this.valueDisplay.textContent = Math.round(displayAngle) + '°';
    }

    getRotation() {
        return this.currentRotation;
    }
}
