// src/particles.ts
var activeAnimations = new Map;
function createParticles(container, count = 36) {
  const particles = [];
  container.innerHTML = "";
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0;i < count; i++) {
    const particle = document.createElement("div");
    particle.className = "particle";
    container.appendChild(particle);
    const theta = goldenAngle * i;
    const phi = Math.acos(1 - 2 * (i + 0.5) / count);
    const sphere = {
      x: Math.sin(phi) * Math.cos(theta),
      y: Math.cos(phi),
      z: Math.sin(phi) * Math.sin(theta)
    };
    particles.push({
      el: particle,
      sphere,
      streamY: Math.random(),
      speed: 0.015 + Math.random() * 0.02,
      offset: Math.random() * Math.PI * 2
    });
  }
  return particles;
}
function initParticles(container, mode = "drift") {
  if (container === null) {
    return;
  }
  const existing = activeAnimations.get(container);
  if (existing !== undefined && existing.animationId !== null) {
    cancelAnimationFrame(existing.animationId);
  }
  const animation = {
    container,
    particles: createParticles(container),
    mode,
    animationId: null
  };
  activeAnimations.set(container, animation);
  animateParticles(animation);
}
function setParticleMode(container, mode) {
  if (container === null) {
    return;
  }
  const animation = activeAnimations.get(container);
  if (animation !== undefined) {
    animation.mode = mode;
  }
}
function transitionToDrift(container, callback) {
  if (container === null) {
    return;
  }
  const animation = activeAnimations.get(container);
  if (animation === undefined) {
    return;
  }
  if (animation.animationId !== null) {
    cancelAnimationFrame(animation.animationId);
    animation.animationId = null;
  }
  const { particles, mode } = animation;
  const width = container.offsetWidth;
  const height = container.offsetHeight;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.35;
  const streamHeight = height + 20;
  const sphereTop = centerY - radius;
  const sphereBottom = centerY + radius;
  particles.forEach((p) => {
    const currentY = p.streamY * streamHeight - 10;
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
function animateFilling(animation) {
  const { container, particles, fillStartTime, fillDuration, fillDirection } = animation;
  if (!container.isConnected) {
    activeAnimations.delete(container);
    return;
  }
  if (fillStartTime === undefined || fillDuration === undefined || fillDirection === undefined) {
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
  const sphereTop = centerY - radius;
  const sphereBottom = centerY + radius;
  const rotationSpeed = 0.4;
  const angle = time * rotationSpeed;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  let catchThreshold;
  if (fillDirection === "up") {
    catchThreshold = -1 + progress * 2;
  } else {
    catchThreshold = 1 - progress * 2;
  }
  particles.forEach((p) => {
    const sx = p.sphere.x;
    const sy = p.sphere.y;
    const sz = p.sphere.z;
    const rx = sx * cosA + sz * sinA;
    const ry = sy;
    const rz = -sx * sinA + sz * cosA;
    const x3d = rx * radius;
    const y3d = ry * radius;
    const z3d = rz * radius;
    const perspectiveScale = focalLength / (focalLength + z3d);
    const sphereX = centerX + x3d * perspectiveScale;
    const sphereY = centerY + y3d * perspectiveScale;
    const streamX = centerX + sx * (streamWidth / 2);
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
    const streamY = p.streamY * streamHeight - 10;
    let x;
    let y;
    let scale;
    let opacity;
    let slotReady;
    if (fillDirection === "up") {
      slotReady = sy <= catchThreshold;
    } else {
      slotReady = sy >= catchThreshold;
    }
    let inCatchZone;
    if (fillDirection === "up") {
      inCatchZone = streamY <= sphereBottom + 5 && streamY >= sphereTop - 5;
    } else {
      inCatchZone = streamY >= sphereTop - 5 && streamY <= sphereBottom + 5;
    }
    let isPastSphere;
    if (fillDirection === "up") {
      isPastSphere = streamY < sphereTop + 10;
    } else {
      isPastSphere = streamY > sphereBottom - 10;
    }
    if (p.caught === true) {
      x = sphereX;
      y = sphereY;
      const depthFactor = (rz + 1) / 2;
      scale = 0.6 + Math.sin(time * 3 + p.offset) * 0.2;
      opacity = 0.5 + Math.sin(time * 2 + p.offset) * 0.3 * depthFactor;
    } else if (slotReady && inCatchZone) {
      p.caught = true;
      x = sphereX;
      y = sphereY;
      const depthFactor = (rz + 1) / 2;
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
    animation.animationId = requestAnimationFrame(() => {
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
function animateParticles(animation) {
  const { container, particles, mode } = animation;
  if (!container.isConnected) {
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
  const streamWidth = width * 0.4;
  particles.forEach((p) => {
    let x;
    let y;
    let scale;
    let opacity;
    const sx = p.sphere.x;
    const sy = p.sphere.y;
    const sz = p.sphere.z;
    if (mode === "up" || mode === "down") {
      const streamX = centerX + sx * (streamWidth / 2);
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
      const streamHeight = height + 20;
      y = p.streamY * streamHeight - 10;
      x = streamX;
      scale = 0.6 + Math.sin(time * 3 + p.offset) * 0.2;
      opacity = 0.5 + Math.sin(time * 2 + p.offset) * 0.3;
    } else {
      const rotationSpeed = 0.4;
      const angle = time * rotationSpeed;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const rx = sx * cosA + sz * sinA;
      const ry = sy;
      const rz = -sx * sinA + sz * cosA;
      const x3d = rx * radius;
      const y3d = ry * radius;
      const z3d = rz * radius;
      const perspectiveScale = focalLength / (focalLength + z3d);
      x = centerX + x3d * perspectiveScale;
      y = centerY + y3d * perspectiveScale;
      const depthFactor = (rz + 1) / 2;
      scale = 0.6 + Math.sin(time * 3 + p.offset) * 0.2;
      opacity = 0.5 + Math.sin(time * 2 + p.offset) * 0.3 * depthFactor;
    }
    p.el.style.transform = `translate(${String(x - 4)}px, ${String(y - 4)}px) scale(${String(scale)})`;
    p.el.style.opacity = String(opacity);
  });
  animation.animationId = requestAnimationFrame(() => {
    animateParticles(animation);
  });
}
function morphParticlesToCheck(container, callback) {
  if (container === null) {
    return;
  }
  const animation = activeAnimations.get(container);
  if (animation !== undefined && animation.animationId !== null) {
    cancelAnimationFrame(animation.animationId);
    animation.animationId = null;
  }
  const particles = container.querySelectorAll(".particle");
  const width = container.offsetWidth;
  const height = container.offsetHeight;
  const centerX = width / 2;
  const centerY = height / 2;
  const checkPath = [
    { x: -18, y: 2 },
    { x: -6, y: 14 },
    { x: 18, y: -10 }
  ];
  particles.forEach((p, i) => {
    const progress = i / (particles.length - 1);
    let x;
    let y;
    const point0 = checkPath[0];
    const point1 = checkPath[1];
    const point2 = checkPath[2];
    if (point0 === undefined || point1 === undefined || point2 === undefined) {
      return;
    }
    if (progress < 0.4) {
      const t = progress / 0.4;
      x = point0.x + (point1.x - point0.x) * t;
      y = point0.y + (point1.y - point0.y) * t;
    } else {
      const t = (progress - 0.4) / 0.6;
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
function morphParticlesToError(container, callback) {
  if (container === null) {
    return;
  }
  const animation = activeAnimations.get(container);
  if (animation !== undefined && animation.animationId !== null) {
    cancelAnimationFrame(animation.animationId);
    animation.animationId = null;
  }
  const particles = container.querySelectorAll(".particle");
  const width = container.offsetWidth;
  const height = container.offsetHeight;
  const centerX = width / 2;
  const centerY = height / 2;
  const size = 14;
  const xPath1 = [
    { x: -size, y: -size },
    { x: size, y: size }
  ];
  const xPath2 = [
    { x: size, y: -size },
    { x: -size, y: size }
  ];
  const half = Math.floor(particles.length / 2);
  particles.forEach((p, i) => {
    let x;
    let y;
    if (i < half) {
      const t = half > 1 ? i / (half - 1) : 0.5;
      const path1Start = xPath1[0];
      const path1End = xPath1[1];
      if (path1Start === undefined || path1End === undefined) {
        return;
      }
      x = path1Start.x + (path1End.x - path1Start.x) * t;
      y = path1Start.y + (path1End.y - path1Start.y) * t;
    } else {
      const remaining = particles.length - half;
      const t = remaining > 1 ? (i - half) / (remaining - 1) : 0.5;
      const path2Start = xPath2[0];
      const path2End = xPath2[1];
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
function stopParticles(container) {
  if (container === null) {
    return;
  }
  const animation = activeAnimations.get(container);
  if (animation !== undefined) {
    if (animation.animationId !== null) {
      cancelAnimationFrame(animation.animationId);
    }
    activeAnimations.delete(container);
  }
}
window.initParticles = initParticles;
window.setParticleMode = setParticleMode;
window.transitionToDrift = transitionToDrift;
window.morphParticlesToCheck = morphParticlesToCheck;
window.morphParticlesToError = morphParticlesToError;
window.stopParticles = stopParticles;
