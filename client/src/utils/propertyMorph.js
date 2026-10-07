import { animate } from 'framer-motion';

/**
 * Shared-element transition between an Explore card and the property page.
 *
 * The route change itself is untouched: the link still navigates exactly as it
 * did before. What this adds is an overlay that holds a clone of the card's
 * media and body in place while Explore plays its exit, then flies the clone
 * onto the real gallery and summary as soon as the destination renders.
 *
 * The overlay lives outside React (plain nodes appended to `body`) so it
 * outlives the page that created it, and it is skipped entirely for reduced
 * motion, keyboard activation and modified clicks.
 */

const EASE = [0.22, 1, 0.36, 1];
const DETECT_DEADLINE = 2500;
const LAND_DURATION = 0.4;
const FADE_DURATION = 0.2;

let active = null;

const lerp = (from, to, progress) => from + (to - from) * progress;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const isPlainLeftClick = (event) =>
  event.button === 0 &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.shiftKey &&
  !event.altKey;

/** framer writes transforms as matrices; only the vertical offset matters here. */
function readTranslateY(element) {
  if (!element) return 0;
  const transform = window.getComputedStyle(element).transform;
  if (!transform || transform === 'none') return 0;
  const match = transform.match(/matrix(3d)?\(([^)]+)\)/);
  if (!match) return 0;
  const values = match[2].split(',').map(Number);
  return (match[1] ? values[13] : values[5]) || 0;
}

function tweenRect(element, to, { includeHeight = true, onComplete } = {}) {
  const style = window.getComputedStyle(element);
  const from = {
    left: Number.parseFloat(element.style.left) || 0,
    top: Number.parseFloat(element.style.top) || 0,
    width: Number.parseFloat(element.style.width) || element.offsetWidth,
    height: Number.parseFloat(element.style.height) || element.offsetHeight,
    radius: Number.parseFloat(style.borderTopLeftRadius) || 0,
  };
  const target = { radius: 10, ...to };

  return animate(0, 1, {
    duration: LAND_DURATION,
    ease: EASE,
    onUpdate: (progress) => {
      element.style.left = `${lerp(from.left, target.left, progress)}px`;
      element.style.top = `${lerp(from.top, target.top, progress)}px`;
      element.style.width = `${lerp(from.width, target.width, progress)}px`;
      if (includeHeight) element.style.height = `${lerp(from.height, target.height, progress)}px`;
      element.style.borderRadius = `${lerp(from.radius, target.radius, progress)}px`;
    },
    onComplete,
  });
}

function tweenOpacity(element, to, duration, onComplete) {
  const from = Number.parseFloat(window.getComputedStyle(element).opacity) || 1;
  return animate(0, 1, {
    duration,
    ease: 'linear',
    onUpdate: (progress) => {
      element.style.opacity = `${lerp(from, to, progress)}`;
    },
    onComplete,
  });
}

function destroyActive() {
  if (!active) return;
  active.dispose();
}

function place(element, rect) {
  element.style.left = `${rect.left}px`;
  element.style.top = `${rect.top}px`;
  element.style.width = `${rect.width}px`;
  element.style.height = rect.height ? `${rect.height}px` : 'auto';
}

/**
 * Runs from a property card's click handler. Returns without doing anything
 * unless this is a plain mouse click on a card that has both media and a body.
 */
export function morphPropertyToDetail(event) {
  if (event.defaultPrevented || !isPlainLeftClick(event)) return;
  // Keyboard and programmatic activations navigate straight away: they have no
  // pointer origin to morph from, and delaying them would only hurt.
  if (event.detail === 0) return;
  if (prefersReducedMotion()) return;

  const link = event.currentTarget;
  const card = link.closest('[data-morph-card]') || link;
  const media = card.querySelector('[data-morph-media]');
  const body = card.querySelector('[data-morph-body]');
  if (!media) return;

  const mediaRect = media.getBoundingClientRect();
  if (mediaRect.width < 2 || mediaRect.height < 2) return;

  destroyActive();

  const overlay = document.createElement('div');
  overlay.className = 'morph-overlay';
  overlay.setAttribute('aria-hidden', 'true');

  const mediaClone = media.cloneNode(true);
  mediaClone.classList.add('morph-clone', 'morph-clone-media');
  place(mediaClone, mediaRect);
  const sourceImage = media.querySelector('img');
  const clonedImage = mediaClone.querySelector('img');
  if (sourceImage && clonedImage) {
    // Freeze the hover zoom the pointer is currently holding, so the clone is
    // pixel-identical to the card it replaces.
    clonedImage.style.transform = window.getComputedStyle(sourceImage).transform;
  }
  overlay.appendChild(mediaClone);

  let bodyClone = null;
  if (body) {
    bodyClone = body.cloneNode(true);
    bodyClone.classList.add('morph-clone', 'morph-clone-body');
    place(bodyClone, body.getBoundingClientRect());
    overlay.appendChild(bodyClone);
  }

  document.body.appendChild(overlay);
  // Deferred one frame so the resting shadow is committed first and the lift
  // reads as a transition rather than a jump.
  requestAnimationFrame(() => mediaClone.classList.add('morph-clone-lifted'));

  const controls = [];
  let disposed = false;

  const state = {
    node: overlay,
    dispose() {
      if (disposed) return;
      disposed = true;
      controls.forEach((control) => control.stop());
      overlay.remove();
      if (active === state) active = null;
    },
  };
  active = state;

  const land = () => {
    const gallery = document.querySelector('.detail-main-image');
    const rect = gallery ? gallery.getBoundingClientRect() : null;
    const valid = rect && rect.width > 2 && rect.height > 2;

    if (valid) {
      const offset = readTranslateY(gallery.parentElement);
      controls.push(
        tweenRect(mediaClone, { left: rect.left, top: rect.top - offset, width: rect.width, height: rect.height }, {
          onComplete: () => controls.push(tweenOpacity(overlay, 0, FADE_DURATION, state.dispose)),
        }),
      );
    } else {
      controls.push(tweenOpacity(overlay, 0, FADE_DURATION, state.dispose));
    }

    if (bodyClone) {
      const summary = document.querySelector('.detail-summary h1') || document.querySelector('.detail-summary');
      const summaryRect = summary ? summary.getBoundingClientRect() : null;
      if (summaryRect && summaryRect.width > 2) {
        const offset = readTranslateY(summary.closest('.detail-summary') || summary.parentElement);
        controls.push(
          tweenRect(bodyClone, { left: summaryRect.left, top: summaryRect.top - offset, width: summaryRect.width }, {
            includeHeight: false,
          }),
        );
      }
      controls.push(tweenOpacity(bodyClone, 0, LAND_DURATION + 0.1));
    }

    mediaClone.querySelectorAll('.morph-chips').forEach((chips) => controls.push(tweenOpacity(chips, 0, 0.3)));
  };

  const startedAt = performance.now();
  const waitForGallery = () => {
    if (disposed) return;
    const gallery = document.querySelector('.detail-main-image');
    const rect = gallery ? gallery.getBoundingClientRect() : null;
    if (rect && rect.width > 2) {
      land();
      return;
    }
    if (performance.now() - startedAt > DETECT_DEADLINE) {
      land();
      return;
    }
    requestAnimationFrame(waitForGallery);
  };

  requestAnimationFrame(waitForGallery);
}
