/**
 * Particle Animation System
 * Flowing particles that morph into shapes (checkmark, error X)
 */

// Make this file a module for global augmentation
export {};

// ============================================================
// TYPE DEFINITIONS
// ============================================================

interface SphereCoordinates {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

interface Particle {
  readonly el: HTMLDivElement;
  readonly sphere: SphereCoordinates;
  readonly speed: number;
  readonly offset: number;
  streamY: number;
  caught?: boolean;
}

type AnimationMode = "up" | "down" | "drift" | "filling";

interface AnimationState {
  readonly container: HTMLElement;
  readonly particles: Particle[];
  mode: AnimationMode;
  animationId: number | null;
  fillStartTime?: number;
  fillDuration?: number;
  fillDirection?: "up" | "down";
  callback?: (() => void) | null;
}

// ============================================================
// MODULE STATE
// ============================================================

const activeAnimations: Map<HTMLElement, AnimationState> = new Map();

// ============================================================
// PARTICLE CREATION
// ============================================================

/**
 * Create particle elements in a container
 */
function createParticles(
  container: HTMLElement,
  count: number = 36
): Particle[] {
  const particles: Particle[] = [];
  container.innerHTML = "";

  const goldenAngle: number = Math.PI * (3 - Math.sqrt(5));

  for (let i: number = 0; i < count; i++) {
    const particle: HTMLDivElement = document.createElement("div");
    particle.className = "particle";
    container.appendChild(particle);

    const theta: number = goldenAngle * i;
    const phi: number = Math.acos(1 - (2 * (i + 0.5)) / count);

    const sphere: SphereCoordinates = {
      x: Math.sin(phi) * Math.cos(theta),
      y: Math.cos(phi),
      z: Math.sin(phi) * Math.sin(theta),
    };

    particles.push({
      el: particle,
      sphere: sphere,
      streamY: Math.random(),
      speed: 0.015 + Math.random() * 0.02,
      offset: Math.random() * Math.PI * 2,
    });
  }

  return particles;
}

// ============================================================
// ANIMATION INITIALIZATION
// ============================================================

/**
 * Initialize particles with a specific animation mode
 */
function initParticles(
  container: HTMLElement | null,
  mode: AnimationMode = "drift"
): void {
  if (container === null) {
    return;
  }

  const existing: AnimationState | undefined = activeAnimations.get(container);
  if (existing !== undefined && existing.animationId !== null) {
    cancelAnimationFrame(existing.animationId);
  }

  const animation: AnimationState = {
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
 */
function setParticleMode(
  container: HTMLElement | null,
  mode: AnimationMode
): void {
  if (container === null) {
    return;
  }

  const animation: AnimationState | undefined = activeAnimations.get(container);
  if (animation !== undefined) {
    animation.mode = mode;
  }
}

// ============================================================
// TRANSITION ANIMATIONS
// ============================================================

/**
 * Smoothly transition particles from stream to drift mode
 */
function transitionToDrift(
  container: HTMLElement | null,
  callback?: () => void
): void {
  if (container === null) {
    return;
  }

  const animation: AnimationState | undefined = activeAnimations.get(container);
  if (animation === undefined) {
    return;
  }

  if (animation.animationId !== null) {
    cancelAnimationFrame(animation.animationId);
    animation.animationId = null;
  }

  const { particles, mode }: { particles: Particle[]; mode: AnimationMode } = animation;
  const width: number = container.offsetWidth;
  const height: number = container.offsetHeight;
  const centerY: number = height / 2;
  const radius: number = Math.min(width, height) * 0.35;
  const streamHeight: number = height + 20;
  const sphereTop: number = centerY - radius;
  const sphereBottom: number = centerY + radius;

  particles.forEach((p: Particle): void => {
    const currentY: number = p.streamY * streamHeight - 10;

    if (mode === "up") {
      p.caught = currentY >= sphereBottom - 10;
    } else {
      p.caught = currentY <= sphereTop + 10;
    }
  });

  animation.mode = "filling";
  animation.fillStartTime = Date.now();
  animation.fillDuration = 800;
  animation.fillDirection = mode === "up" ? "up" : "down";
  animation.callback = callback ?? null;

  animateFilling(animation);
}

// ============================================================
// FILLING ANIMATION
// ============================================================

/**
 * Animate particles filling into the sphere from stream
 */
function animateFilling(animation: AnimationState): void {
  const { container, particles, fillStartTime, fillDuration, fillDirection }: {
    readonly container: HTMLElement;
    readonly particles: Particle[];
    fillStartTime?: number;
    fillDuration?: number;
    fillDirection?: "up" | "down";
  } = animation;

  if (!container.isConnected) {
    activeAnimations.delete(container);
    return;
  }

  if (
    fillStartTime === undefined ||
    fillDuration === undefined ||
    fillDirection === undefined
  ) {
    return;
  }

  const elapsed: number = Date.now() - fillStartTime;
  const progress: number = Math.min(elapsed / fillDuration, 1);
  const time: number = Date.now() * 0.001;

  const width: number = container.offsetWidth;
  const height: number = container.offsetHeight;
  const centerX: number = width / 2;
  const centerY: number = height / 2;
  const radius: number = Math.min(width, height) * 0.35;
  const focalLength: number = 200;
  const streamWidth: number = width * 0.4;
  const streamHeight: number = height + 20;
  const sphereTop: number = centerY - radius;
  const sphereBottom: number = centerY + radius;

  const rotationSpeed: number = 0.4;
  const angle: number = time * rotationSpeed;
  const cosA: number = Math.cos(angle);
  const sinA: number = Math.sin(angle);

  let catchThreshold: number;
  if (fillDirection === "up") {
    catchThreshold = -1 + progress * 2;
  } else {
    catchThreshold = 1 - progress * 2;
  }

  particles.forEach((p: Particle): void => {
    const sx: number = p.sphere.x;
    const sy: number = p.sphere.y;
    const sz: number = p.sphere.z;

    const rx: number = sx * cosA + sz * sinA;
    const ry: number = sy;
    const rz: number = -sx * sinA + sz * cosA;

    const x3d: number = rx * radius;
    const y3d: number = ry * radius;
    const z3d: number = rz * radius;

    const perspectiveScale: number = focalLength / (focalLength + z3d);
    const sphereX: number = centerX + x3d * perspectiveScale;
    const sphereY: number = centerY + y3d * perspectiveScale;
    const streamX: number = centerX + sx * (streamWidth / 2);

    if (p.caught !== true) {
      if (fillDirection === "up") {
        p.streamY -= p.speed;
        if (p.streamY < 0) {
          p.streamY += 1;
        }
      } else {
        p.streamY += p.speed;
        if (p.streamY > 1) {
          p.streamY -= 1;
        }
      }
    }

    const streamY: number = p.streamY * streamHeight - 10;

    let x: number;
    let y: number;
    let scale: number;
    let opacity: number;

    let slotReady: boolean;
    if (fillDirection === "up") {
      slotReady = sy <= catchThreshold;
    } else {
      slotReady = sy >= catchThreshold;
    }

    let inCatchZone: boolean;
    if (fillDirection === "up") {
      inCatchZone = streamY <= sphereBottom + 5 && streamY >= sphereTop - 5;
    } else {
      inCatchZone = streamY >= sphereTop - 5 && streamY <= sphereBottom + 5;
    }

    let isPastSphere: boolean;
    if (fillDirection === "up") {
      isPastSphere = streamY < sphereTop + 10;
    } else {
      isPastSphere = streamY > sphereBottom - 10;
    }

    if (p.caught === true) {
      x = sphereX;
      y = sphereY;
      const depthFactor: number = (rz + 1) / 2;
      scale = 0.6 + Math.sin(time * 3 + p.offset) * 0.2;
      opacity = 0.5 + Math.sin(time * 2 + p.offset) * 0.3 * depthFactor;
    } else if (slotReady && inCatchZone) {
      p.caught = true;
      x = sphereX;
      y = sphereY;
      const depthFactor: number = (rz + 1) / 2;
      scale = 0.6 + Math.sin(time * 3 + p.offset) * 0.2;
      opacity = 0.5 + Math.sin(time * 2 + p.offset) * 0.3 * depthFactor;
    } else if (isPastSphere) {
      x = streamX;
      y = streamY;
      scale = 0.6;
      opacity = 0;
    } else {
      x = streamX;
      y = streamY;
      scale = 0.6 + Math.sin(time * 3 + p.offset) * 0.2;
      opacity = 0.5 + Math.sin(time * 2 + p.offset) * 0.3;
    }

    p.el.style.transform = `translate(${String(x - 4)}px, ${String(y - 4)}px) scale(${String(scale)})`;
    p.el.style.opacity = String(opacity);
  });

  if (progress < 1) {
    animation.animationId = requestAnimationFrame((): void => {
      animateFilling(animation);
    });
  } else {
    animation.mode = "drift";
    animateParticles(animation);

    if (animation.callback !== undefined && animation.callback !== null) {
      animation.callback();
      animation.callback = null;
    }
  }
}

// ============================================================
// MAIN ANIMATION LOOP
// ============================================================

/**
 * Main animation loop for particles
 */
function animateParticles(animation: AnimationState): void {
  const { container, particles, mode }: { container: HTMLElement; particles: Particle[]; mode: AnimationMode } = animation;

  if (!container.isConnected) {
    activeAnimations.delete(container);
    return;
  }

  const time: number = Date.now() * 0.001;
  const width: number = container.offsetWidth;
  const height: number = container.offsetHeight;

  const centerX: number = width / 2;
  const centerY: number = height / 2;
  const radius: number = Math.min(width, height) * 0.35;
  const focalLength: number = 200;
  const streamWidth: number = width * 0.4;

  particles.forEach((p: Particle): void => {
    let x: number;
    let y: number;
    let scale: number;
    let opacity: number;

    const sx: number = p.sphere.x;
    const sy: number = p.sphere.y;
    const sz: number = p.sphere.z;

    if (mode === "up" || mode === "down") {
      const streamX: number = centerX + sx * (streamWidth / 2);

      if (mode === "up") {
        p.streamY -= p.speed;
        if (p.streamY < 0) {
          p.streamY += 1;
        }
      } else {
        p.streamY += p.speed;
        if (p.streamY > 1) {
          p.streamY -= 1;
        }
      }

      const streamHeight: number = height + 20;
      y = p.streamY * streamHeight - 10;
      x = streamX;

      scale = 0.6 + Math.sin(time * 3 + p.offset) * 0.2;
      opacity = 0.5 + Math.sin(time * 2 + p.offset) * 0.3;
    } else {
      const rotationSpeed: number = 0.4;
      const angle: number = time * rotationSpeed;
      const cosA: number = Math.cos(angle);
      const sinA: number = Math.sin(angle);

      const rx: number = sx * cosA + sz * sinA;
      const ry: number = sy;
      const rz: number = -sx * sinA + sz * cosA;

      const x3d: number = rx * radius;
      const y3d: number = ry * radius;
      const z3d: number = rz * radius;

      const perspectiveScale: number = focalLength / (focalLength + z3d);

      x = centerX + x3d * perspectiveScale;
      y = centerY + y3d * perspectiveScale;

      const depthFactor: number = (rz + 1) / 2;
      scale = 0.6 + Math.sin(time * 3 + p.offset) * 0.2;
      opacity = 0.5 + Math.sin(time * 2 + p.offset) * 0.3 * depthFactor;
    }

    p.el.style.transform = `translate(${String(x - 4)}px, ${String(y - 4)}px) scale(${String(scale)})`;
    p.el.style.opacity = String(opacity);
  });

  animation.animationId = requestAnimationFrame((): void => {
    animateParticles(animation);
  });
}

// ============================================================
// SHAPE MORPHING
// ============================================================

interface PathPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Morph particles into a checkmark shape
 */
function morphParticlesToCheck(
  container: HTMLElement | null,
  callback?: () => void
): void {
  if (container === null) {
    return;
  }

  const animation: AnimationState | undefined = activeAnimations.get(container);
  if (animation !== undefined && animation.animationId !== null) {
    cancelAnimationFrame(animation.animationId);
    animation.animationId = null;
  }

  const particles: NodeListOf<HTMLDivElement> =
    container.querySelectorAll<HTMLDivElement>(".particle");
  const width: number = container.offsetWidth;
  const height: number = container.offsetHeight;
  const centerX: number = width / 2;
  const centerY: number = height / 2;

  const checkPath: readonly PathPoint[] = [
    { x: -18, y: 2 },
    { x: -6, y: 14 },
    { x: 18, y: -10 },
  ] as const;

  particles.forEach((p: HTMLDivElement, i: number): void => {
    const progress: number = i / (particles.length - 1);
    let x: number;
    let y: number;

    const point0: PathPoint | undefined = checkPath[0];
    const point1: PathPoint | undefined = checkPath[1];
    const point2: PathPoint | undefined = checkPath[2];

    if (
      point0 === undefined ||
      point1 === undefined ||
      point2 === undefined
    ) {
      return;
    }

    if (progress < 0.4) {
      const t: number = progress / 0.4;
      x = point0.x + (point1.x - point0.x) * t;
      y = point0.y + (point1.y - point0.y) * t;
    } else {
      const t: number = (progress - 0.4) / 0.6;
      x = point1.x + (point2.x - point1.x) * t;
      y = point1.y + (point2.y - point1.y) * t;
    }

    p.style.transition = "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
    p.style.transitionDelay = `${String(i * 6)}ms`;
    p.style.transform = `translate(${String(centerX + x - 4)}px, ${String(centerY + y - 4)}px) scale(1)`;
    p.style.opacity = "1";
    p.style.background = "var(--particle-success, var(--success))";
  });

  if (callback !== undefined) {
    setTimeout(callback, 400 + particles.length * 6);
  }
}

/**
 * Morph particles into an X/error shape
 */
function morphParticlesToError(
  container: HTMLElement | null,
  callback?: () => void
): void {
  if (container === null) {
    return;
  }

  const animation: AnimationState | undefined = activeAnimations.get(container);
  if (animation !== undefined && animation.animationId !== null) {
    cancelAnimationFrame(animation.animationId);
    animation.animationId = null;
  }

  const particles: NodeListOf<HTMLDivElement> =
    container.querySelectorAll<HTMLDivElement>(".particle");
  const width: number = container.offsetWidth;
  const height: number = container.offsetHeight;
  const centerX: number = width / 2;
  const centerY: number = height / 2;

  const size: number = 14;
  const xPath1: readonly PathPoint[] = [
    { x: -size, y: -size },
    { x: size, y: size },
  ] as const;
  const xPath2: readonly PathPoint[] = [
    { x: size, y: -size },
    { x: -size, y: size },
  ] as const;

  const half: number = Math.floor(particles.length / 2);

  particles.forEach((p: HTMLDivElement, i: number): void => {
    let x: number;
    let y: number;

    if (i < half) {
      const t: number = half > 1 ? i / (half - 1) : 0.5;
      const path1Start: PathPoint | undefined = xPath1[0];
      const path1End: PathPoint | undefined = xPath1[1];

      if (path1Start === undefined || path1End === undefined) {
        return;
      }

      x = path1Start.x + (path1End.x - path1Start.x) * t;
      y = path1Start.y + (path1End.y - path1Start.y) * t;
    } else {
      const remaining: number = particles.length - half;
      const t: number = remaining > 1 ? (i - half) / (remaining - 1) : 0.5;
      const path2Start: PathPoint | undefined = xPath2[0];
      const path2End: PathPoint | undefined = xPath2[1];

      if (path2Start === undefined || path2End === undefined) {
        return;
      }

      x = path2Start.x + (path2End.x - path2Start.x) * t;
      y = path2Start.y + (path2End.y - path2Start.y) * t;
    }

    p.style.transition = "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
    p.style.transitionDelay = `${String(i * 6)}ms`;
    p.style.transform = `translate(${String(centerX + x - 4)}px, ${String(centerY + y - 4)}px) scale(1)`;
    p.style.opacity = "1";
    p.style.background = "var(--particle-error, var(--error))";
  });

  if (callback !== undefined) {
    setTimeout(callback, 400 + particles.length * 6);
  }
}

/**
 * Stop all particle animations for a container and clean up
 */
function stopParticles(container: HTMLElement | null): void {
  if (container === null) {
    return;
  }

  const animation: AnimationState | undefined = activeAnimations.get(container);
  if (animation !== undefined) {
    if (animation.animationId !== null) {
      cancelAnimationFrame(animation.animationId);
    }
    activeAnimations.delete(container);
  }
}

// ============================================================
// EXPORTS (attach to window for global access)
// ============================================================

declare global {
  interface Window {
    initParticles: typeof initParticles;
    setParticleMode: typeof setParticleMode;
    transitionToDrift: typeof transitionToDrift;
    morphParticlesToCheck: typeof morphParticlesToCheck;
    morphParticlesToError: typeof morphParticlesToError;
    stopParticles: typeof stopParticles;
  }
}

window.initParticles = initParticles;
window.setParticleMode = setParticleMode;
window.transitionToDrift = transitionToDrift;
window.morphParticlesToCheck = morphParticlesToCheck;
window.morphParticlesToError = morphParticlesToError;
window.stopParticles = stopParticles;
