/**
 * Particle Animation System
 * Flowing particles that morph into shapes (checkmark, error X)
 *
 * Usage:
 *   1. Include particles.css (or define your own particle styles)
 *   2. Include this script
 *   3. Create a container: <div class="particle-container" id="myContainer"></div>
 *   4. Initialize: initParticles(container, 'up' | 'down' | 'drift')
 *   5. Morph to shapes: morphParticlesToCheck(container) or morphParticlesToError(container)
 *
 * Required CSS variables:
 *   --particle-color: Default particle color (fallback: --accent-blue)
 *   --particle-success: Success/checkmark color (fallback: --success)
 *   --particle-error: Error/X color (fallback: --error)
 */

// Store active animations by container
const activeAnimations = new Map();

/**
 * Create particle elements in a container
 * @param {HTMLElement} container - Container element
 * @param {number} count - Number of particles to create
 * @returns {Array} Array of particle objects
 */
function createParticles(container, count = 36) {
  if (!container) return [];

  // Clear existing particles
  container.innerHTML = '';
  const particles = [];
  const height = container.offsetHeight || 60;

  // Golden angle for even sphere distribution
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < count; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    container.appendChild(particle);

    // Calculate 3D sphere position using golden angle distribution
    const theta = goldenAngle * i;
    const phi = Math.acos(1 - (2 * (i + 0.5)) / count);

    // 3D sphere coordinates (unit sphere, will be scaled by radius)
    const sphere = {
      x: Math.sin(phi) * Math.cos(theta),
      y: Math.cos(phi),  // Y is up/down axis
      z: Math.sin(phi) * Math.sin(theta),
    };

    // Store particle with 3D coordinates
    // streamY is the cycling Y position for stream mode (0 to 1, wraps around)
    particles.push({
      el: particle,
      sphere: sphere,
      streamY: Math.random(),  // Random starting position in stream (0-1)
      speed: 0.015 + Math.random() * 0.02,  // Speed as fraction of height per frame
      offset: Math.random() * Math.PI * 2,  // Phase offset for oscillation
    });
  }

  return particles;
}

/**
 * Initialize particles with a specific animation mode
 * @param {HTMLElement} container - Container element
 * @param {string} mode - Animation mode: 'up', 'down', or 'drift'
 */
function initParticles(container, mode = 'drift') {
  if (!container) return;

  // Stop any existing animation for this container
  const existing = activeAnimations.get(container);
  if (existing && existing.animationId) {
    cancelAnimationFrame(existing.animationId);
  }

  const animation = {
    container: container,
    particles: createParticles(container),
    mode: mode,
    animationId: null,
  };

  activeAnimations.set(container, animation);
  animateParticles(animation);
}

/**
 * Change the animation mode for a container without recreating particles
 * @param {HTMLElement} container - Container element
 * @param {string} mode - Animation mode: 'up', 'down', or 'drift'
 */
function setParticleMode(container, mode) {
  const animation = activeAnimations.get(container);
  if (animation) {
    animation.mode = mode;
  }
}

/**
 * Smoothly transition particles from stream to drift mode
 * @param {HTMLElement} container - Container element
 * @param {Function} callback - Optional callback after transition completes
 */
function transitionToDrift(container, callback) {
  const animation = activeAnimations.get(container);
  if (!animation) return;

  // Stop the current animation loop
  if (animation.animationId) {
    cancelAnimationFrame(animation.animationId);
    animation.animationId = null;
  }

  const { particles, mode } = animation;
  const width = container.offsetWidth;
  const height = container.offsetHeight;
  const centerX = width / 2;
  const centerY = height / 2;

  // Calculate target positions for drift mode (globe positions)
  const radius = Math.min(width, height) * 0.35;
  const focalLength = 200;
  const streamWidth = width * 0.4;

  // Sphere bounds in screen space
  const sphereTop = centerY - radius;
  const sphereBottom = centerY + radius;

  // Track which particles are "caught" by the sphere
  // For 'up' flow: particles below the sphere bottom get caught first
  // For 'down' flow: particles above the sphere top get caught first
  particles.forEach(p => {
    const streamHeight = height + 20;
    const currentY = p.streamY * streamHeight - 10;

    if (mode === 'up') {
      // Particles that are at or below the sphere's bottom edge get caught
      p.caught = currentY >= sphereBottom - 10;
    } else {
      // Particles that are at or above the sphere's top edge get caught
      p.caught = currentY <= sphereTop + 10;
    }
  });

  // Start a custom animation that fills the sphere gradually
  animation.mode = 'filling';
  animation.fillStartTime = Date.now();
  animation.fillDuration = 800; // ms to fill the sphere
  animation.fillDirection = mode; // 'up' or 'down'
  animation.callback = callback;

  animateFilling(animation);
}

/**
 * Animate particles filling into the sphere from stream
 * @param {Object} animation - Animation state object
 */
function animateFilling(animation) {
  const { container, particles, fillStartTime, fillDuration, fillDirection } = animation;
  if (!container || !container.isConnected) {
    activeAnimations.delete(container);
    return;
  }

  const elapsed = Date.now() - fillStartTime;
  const progress = Math.min(elapsed / fillDuration, 1);
  const time = Date.now() * 0.001;

  const width = container.offsetWidth;
  const height = container.offsetHeight;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.35;
  const focalLength = 200;
  const streamWidth = width * 0.4;
  const streamHeight = height + 20;

  // Sphere bounds
  const sphereTop = centerY - radius;
  const sphereBottom = centerY + radius;

  // Calculate rotation at current time
  const rotationSpeed = 0.4;
  const angle = time * rotationSpeed;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  // The "catch line" moves through the sphere over time based on sphere.y coordinates
  // sphere.y = 1 is top of sphere, sphere.y = -1 is bottom of sphere
  //
  // For 'up': particles flow upward, sphere fills from BOTTOM (-1) to TOP (1)
  // For 'down': particles flow downward, sphere fills from TOP (1) to BOTTOM (-1)
  let catchThreshold;
  if (fillDirection === 'up') {
    // Start catching from bottom (sy = -1), progress toward top (sy = 1)
    catchThreshold = -1 + progress * 2;  // -1 -> 1
  } else {
    // Start catching from top (sy = 1), progress toward bottom (sy = -1)
    catchThreshold = 1 - progress * 2;   // 1 -> -1
  }

  particles.forEach((p, i) => {
    const sx = p.sphere.x;
    const sy = p.sphere.y;
    const sz = p.sphere.z;

    // Calculate sphere target position
    const rx = sx * cosA + sz * sinA;
    const ry = sy;
    const rz = -sx * sinA + sz * cosA;

    const x3d = rx * radius;
    const y3d = ry * radius;
    const z3d = rz * radius;

    const perspectiveScale = focalLength / (focalLength + z3d);
    const sphereX = centerX + x3d * perspectiveScale;
    const sphereY = centerY + y3d * perspectiveScale;

    // Current stream position X (based on sphere.x)
    const streamX = centerX + sx * (streamWidth / 2);

    // ALWAYS update stream position first (even if caught, for consistency)
    if (!p.caught) {
      if (fillDirection === 'up') {
        p.streamY -= p.speed;
        if (p.streamY < 0) p.streamY += 1;
      } else {
        p.streamY += p.speed;
        if (p.streamY > 1) p.streamY -= 1;
      }
    }

    const streamY = p.streamY * streamHeight - 10;

    let x, y, scale, opacity;

    // Check if particle's sphere slot is ready to be filled
    let slotReady;
    if (fillDirection === 'up') {
      slotReady = sy <= catchThreshold;
    } else {
      slotReady = sy >= catchThreshold;
    }

    // Check if particle is in the catch zone
    let inCatchZone = false;
    if (fillDirection === 'up') {
      // Flowing up: catch zone is from bottom of screen up to sphere bottom
      inCatchZone = streamY <= sphereBottom + 5 && streamY >= sphereTop - 5;
    } else {
      // Flowing down: catch zone is from top of screen down to sphere top
      inCatchZone = streamY >= sphereTop - 5 && streamY <= sphereBottom + 5;
    }

    // Check if particle has gone past the sphere (on the wrong side)
    let isPastSphere = false;
    if (fillDirection === 'up') {
      isPastSphere = streamY < sphereTop + 10;
    } else {
      isPastSphere = streamY > sphereBottom - 10;
    }

    if (p.caught) {
      // Already caught - stay at sphere position
      x = sphereX;
      y = sphereY;

      const depthFactor = (rz + 1) / 2;
      scale = 0.6 + Math.sin(time * 3 + p.offset) * 0.2;
      opacity = 0.5 + Math.sin(time * 2 + p.offset) * 0.3 * depthFactor;
    } else if (slotReady && inCatchZone) {
      // Catch this particle now
      p.caught = true;
      x = sphereX;
      y = sphereY;

      const depthFactor = (rz + 1) / 2;
      scale = 0.6 + Math.sin(time * 3 + p.offset) * 0.2;
      opacity = 0.5 + Math.sin(time * 2 + p.offset) * 0.3 * depthFactor;
    } else if (isPastSphere) {
      // Hide particle that went past
      x = streamX;
      y = streamY;
      scale = 0.6;
      opacity = 0;
    } else {
      // Normal streaming particle
      x = streamX;
      y = streamY;
      scale = 0.6 + Math.sin(time * 3 + p.offset) * 0.2;
      opacity = 0.5 + Math.sin(time * 2 + p.offset) * 0.3;
    }

    p.el.style.transform = `translate(${x - 4}px, ${y - 4}px) scale(${scale})`;
    p.el.style.opacity = opacity;
  });

  if (progress < 1) {
    animation.animationId = requestAnimationFrame(() => animateFilling(animation));
  } else {
    // Filling complete, switch to drift mode
    animation.mode = 'drift';
    animateParticles(animation);

    if (animation.callback) {
      animation.callback();
      animation.callback = null;
    }
  }
}

/**
 * Main animation loop for particles
 * @param {Object} animation - Animation state object
 */
function animateParticles(animation) {
  const { container, particles, mode } = animation;
  if (!container || !container.isConnected) {
    activeAnimations.delete(container);
    return;
  }

  const time = Date.now() * 0.001;
  const width = container.offsetWidth;
  const height = container.offsetHeight;

  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.35;
  const focalLength = 200;

  // Stream uses sphere.x to determine horizontal position (flattened)
  const streamWidth = width * 0.4;

  particles.forEach((p, i) => {
    let x, y, scale, opacity;

    // Get the particle's fixed position on the unit sphere
    const sx = p.sphere.x;
    const sy = p.sphere.y;
    const sz = p.sphere.z;

    if (mode === 'up' || mode === 'down') {
      // Stream mode - particles flow vertically
      // X position is derived from sphere.x (creates consistent columns)
      // This maps sphere.x (-1 to 1) to the stream width
      const streamX = centerX + sx * (streamWidth / 2);

      // Update and wrap the Y position
      if (mode === 'up') {
        p.streamY -= p.speed;
        if (p.streamY < 0) p.streamY += 1;
      } else {
        p.streamY += p.speed;
        if (p.streamY > 1) p.streamY -= 1;
      }

      // Map streamY (0-1) to screen coordinates with overflow for smooth wrapping
      const streamHeight = height + 20;  // Extra space for smooth entry/exit
      y = p.streamY * streamHeight - 10;
      x = streamX;

      scale = 0.6 + Math.sin(time * 3 + p.offset) * 0.2;
      opacity = 0.5 + Math.sin(time * 2 + p.offset) * 0.3;

    } else {
      // Drift mode - 3D globe/sphere of particles with perspective
      // Rotate around Y-axis (horizontal spin)
      const rotationSpeed = 0.4;
      const angle = time * rotationSpeed;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // Apply Y-axis rotation matrix
      const rx = sx * cosA + sz * sinA;
      const ry = sy;
      const rz = -sx * sinA + sz * cosA;

      // Scale to actual radius
      const x3d = rx * radius;
      const y3d = ry * radius;
      const z3d = rz * radius;

      // Perspective projection
      const perspectiveScale = focalLength / (focalLength + z3d);

      // Project to 2D with perspective
      x = centerX + x3d * perspectiveScale;
      y = centerY + y3d * perspectiveScale;

      // Use z-depth for size/opacity variation (front vs back of sphere)
      const depthFactor = (rz + 1) / 2;
      scale = 0.6 + Math.sin(time * 3 + p.offset) * 0.2;
      opacity = 0.5 + Math.sin(time * 2 + p.offset) * 0.3 * depthFactor;
    }

    p.el.style.transform = `translate(${x - 4}px, ${y - 4}px) scale(${scale})`;
    p.el.style.opacity = opacity;
  });

  animation.animationId = requestAnimationFrame(() => animateParticles(animation));
}

/**
 * Morph particles into a checkmark shape
 * @param {HTMLElement} container - Container element
 * @param {Function} callback - Callback function after animation completes
 */
function morphParticlesToCheck(container, callback) {
  if (!container) return;

  // Stop flowing animation for this container
  const animation = activeAnimations.get(container);
  if (animation && animation.animationId) {
    cancelAnimationFrame(animation.animationId);
    animation.animationId = null;
  }

  const particles = container.querySelectorAll('.particle');
  const width = container.offsetWidth;
  const height = container.offsetHeight;
  const centerX = width / 2;
  const centerY = height / 2;

  // Checkmark path points (relative to center, scaled up)
  const checkPath = [
    { x: -18, y: 2 },
    { x: -6, y: 14 },
    { x: 18, y: -10 },
  ];

  // Distribute particles along checkmark path
  particles.forEach((p, i) => {
    const progress = i / (particles.length - 1);
    let x, y;

    if (progress < 0.4) {
      // First segment of checkmark (short leg)
      const t = progress / 0.4;
      x = checkPath[0].x + (checkPath[1].x - checkPath[0].x) * t;
      y = checkPath[0].y + (checkPath[1].y - checkPath[0].y) * t;
    } else {
      // Second segment of checkmark (long leg)
      const t = (progress - 0.4) / 0.6;
      x = checkPath[1].x + (checkPath[2].x - checkPath[1].x) * t;
      y = checkPath[1].y + (checkPath[2].y - checkPath[1].y) * t;
    }

    p.style.transition = 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    p.style.transitionDelay = `${i * 6}ms`;
    p.style.transform = `translate(${centerX + x - 4}px, ${centerY + y - 4}px) scale(1)`;
    p.style.opacity = '1';
    p.style.background = 'var(--particle-success, var(--success))';
  });

  // Call callback after animation completes
  if (callback) {
    setTimeout(callback, 400 + particles.length * 6);
  }
}

/**
 * Morph particles into an X/error shape
 * @param {HTMLElement} container - Container element
 * @param {Function} callback - Callback function after animation completes
 */
function morphParticlesToError(container, callback) {
  if (!container) return;

  // Stop flowing animation for this container
  const animation = activeAnimations.get(container);
  if (animation && animation.animationId) {
    cancelAnimationFrame(animation.animationId);
    animation.animationId = null;
  }

  const particles = container.querySelectorAll('.particle');
  const width = container.offsetWidth;
  const height = container.offsetHeight;
  const centerX = width / 2;
  const centerY = height / 2;

  // X shape - two diagonal lines crossing at center
  const size = 14; // Half-size of the X (similar scale to checkmark)
  const xPath1 = [
    { x: -size, y: -size }, // top-left
    { x: size, y: size },   // bottom-right
  ];
  const xPath2 = [
    { x: size, y: -size },  // top-right
    { x: -size, y: size },  // bottom-left
  ];

  const half = Math.floor(particles.length / 2);

  // Distribute particles along both lines of the X
  particles.forEach((p, i) => {
    let x, y;

    if (i < half) {
      // First half: top-left to bottom-right diagonal
      const t = half > 1 ? i / (half - 1) : 0.5;
      x = xPath1[0].x + (xPath1[1].x - xPath1[0].x) * t;
      y = xPath1[0].y + (xPath1[1].y - xPath1[0].y) * t;
    } else {
      // Second half: top-right to bottom-left diagonal
      const remaining = particles.length - half;
      const t = remaining > 1 ? (i - half) / (remaining - 1) : 0.5;
      x = xPath2[0].x + (xPath2[1].x - xPath2[0].x) * t;
      y = xPath2[0].y + (xPath2[1].y - xPath2[0].y) * t;
    }

    p.style.transition = 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    p.style.transitionDelay = `${i * 6}ms`;
    p.style.transform = `translate(${centerX + x - 4}px, ${centerY + y - 4}px) scale(1)`;
    p.style.opacity = '1';
    p.style.background = 'var(--particle-error, var(--error))';
  });

  // Call callback after animation completes
  if (callback) {
    setTimeout(callback, 400 + particles.length * 6);
  }
}

/**
 * Stop all particle animations for a container and clean up
 * @param {HTMLElement} container - Container element
 */
function stopParticles(container) {
  const animation = activeAnimations.get(container);
  if (animation) {
    if (animation.animationId) {
      cancelAnimationFrame(animation.animationId);
    }
    activeAnimations.delete(container);
  }
}
