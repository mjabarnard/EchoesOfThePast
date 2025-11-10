/**
 * Lightbox Module
 * Handles image viewing with navigation and captions
 */

import { LIGHTBOX_IMAGE_SELECTORS } from '../utils/constants.js';

export class Lightbox {
    constructor() {
        this.container = document.getElementById('lightbox');
        this.image = this.container.querySelector('.lightbox-image');
        this.caption = this.container.querySelector('.lightbox-caption');
        this.closeBtn = this.container.querySelector('.lightbox-close');
        this.prevBtn = this.container.querySelector('.lightbox-prev');
        this.nextBtn = this.container.querySelector('.lightbox-next');

        this.images = Array.from(document.querySelectorAll(LIGHTBOX_IMAGE_SELECTORS));
        this.currentIndex = 0;

        this._bindEvents();
    }

    _bindEvents() {
        // Image clicks
        this.images.forEach((img, index) => {
            img.addEventListener('click', () => this.open(index));
        });

        // Close button
        this.closeBtn.addEventListener('click', () => this.close());

        // Navigation buttons
        this.prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.navigate(-1);
        });

        this.nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.navigate(1);
        });

        // Click outside to close
        this.container.addEventListener('click', (e) => {
            if (e.target === this.container) {
                this.close();
            }
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (!this.container.classList.contains('active')) return;

            switch (e.key) {
                case 'Escape':
                    this.close();
                    break;
                case 'ArrowLeft':
                    this.navigate(-1);
                    break;
                case 'ArrowRight':
                    this.navigate(1);
                    break;
            }
        });
    }

    open(index) {
        this._showImage(index);
        this.container.classList.add('active');
    }

    close() {
        this.container.classList.remove('active');
    }

    navigate(direction) {
        let newIndex = this.currentIndex + direction;

        // Wrap around
        if (newIndex < 0) newIndex = this.images.length - 1;
        if (newIndex >= this.images.length) newIndex = 0;

        this._showImage(newIndex);
    }

    _showImage(index) {
        const img = this.images[index];
        if (!img) return;

        // Get full-size image URL
        const fullsizeUrl = img.getAttribute('data-fullsize') || img.src;
        this.image.src = fullsizeUrl;
        this.image.alt = img.alt;

        // Extract caption
        const captionText = this._extractCaption(img);
        this.caption.textContent = captionText;

        this.currentIndex = index;
    }

    _extractCaption(img) {
        // Try to find caption element next to image
        const captionElement = img.nextElementSibling;
        if (captionElement && captionElement.classList.contains('image-caption')) {
            return captionElement.textContent;
        }

        // Fallback to alt text
        return img.alt || '';
    }
}
