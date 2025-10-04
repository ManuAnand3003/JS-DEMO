/**
 * Canvas Particles & Creatures Demo
 *
 * This script powers a canvas-based animation demo featuring a particle system
 * and several interactive, procedurally animated creatures. It handles rendering,
 * user interaction, and the logic for each entity.
 */
(() => {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  let w = canvas.width = innerWidth;
  let h = canvas.height = innerHeight;

  // Handle window resizing
  window.addEventListener('resize', () => {
    w = canvas.width = innerWidth;
    h = canvas.height = innerHeight;
  });

  const rand = (a, b) => Math.random() * (b - a) + a;

  // Linear interpolation
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  // Circular linear interpolation (for angles)
  function angleLerp(a, b, t) {
    const diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    return a + diff * t;
  }

  /**
   * Particle class for creating and managing particle effects.
   * Each particle has a position, velocity, size, lifespan, and color.
   * Particles are used for visual effects like smoke, fire, and sparkles.
   */
  class Particle {
    // options: {vx,vy,size,life,hue,color}
    constructor(x, y, options = {}) {
      this.x = x;
      this.y = y;
      if (options.vx !== undefined) {
        this.vx = options.vx;
      } else {
        const angle = Math.random() * Math.PI * 2;
        const speed = rand(0.2, 2);
        this.vx = Math.cos(angle) * speed;
      }
      if (options.vy !== undefined) {
        this.vy = options.vy;
      } else {
        const angle = Math.random() * Math.PI * 2;
        const speed = rand(0.2, 2);
        this.vy = Math.sin(angle) * speed;
      }
      this.size = options.size ?? rand(1, 4);
      this.life = options.life ?? rand(60, 200);
      this.hue = options.hue ?? rand(180, 260);
      this.color = options.color; // optional CSS color
    }
    update(speedMultiplier) {
      /**
       * Updates the particle's properties based on the provided speed multiplier.
       * This method is responsible for updating the particle's position,
       * decreasing its lifespan, and reducing its size over time.
       * @param {number} speedMultiplier - A multiplier to adjust the particle's speed.
       */
      this.x += this.vx * speedMultiplier;
      this.y += this.vy * speedMultiplier;
      this.life -= 1;
      if (this.size > 0.08) this.size *= 0.996;
    }
    draw(ctx) {
      ctx.beginPath();
      /**
       * Draws the particle on the canvas context.
       * Uses either a specified CSS color or a hue-based color derived from the particle's properties.
       * Fades the particle out as its life decreases.
       */
      if (this.color) {
        // color is full CSS color, fade with life
        const alpha = Math.max(0, this.life / 200);
        // Use globalAlpha as a simple way to fade any CSS color.
        ctx.fillStyle = this.color;
        ctx.globalAlpha = alpha;
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = `hsla(${this.hue},85%,60%,${Math.max(0, this.life / 200)})`;
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  let particles = [];

  /**
   * Spawns a specified number of particles at a given x and y coordinate.
   * @param {number} x - The x coordinate at which to spawn the particles.
   * @param {number} y - The y coordinate at which to spawn the particles.
   * @param {number} n - The number of particles to spawn. Defaults to 6.
   */
  function spawn(x, y, n = 6) {
    for (let i = 0; i < n; i++) particles.push(new Particle(x, y));
  }

  // =================================================================
  // UI CONTROLS
  // This section handles the sidebar UI for selecting entities and adjusting parameters.
  // =================================================================
  const countRange = document.getElementById('count');
  const speedRange = document.getElementById('speed');
  const clearBtn = document.getElementById('clear');
  const countLabel = document.getElementById('countLabel');
  const speedLabel = document.getElementById('speedLabel');
  // The entity selector dropdown, which replaced the old "Snake Mode" toggle
  const entitySelect = document.getElementById('entitySelect');

  // Event listeners for the UI controls
  countRange.addEventListener('input', () => countLabel.textContent = countRange.value);
  speedRange.addEventListener('input', () => speedLabel.textContent = Number(speedRange.value).toFixed(1));
  clearBtn.addEventListener('click', () => particles = []);

  // pointer (click/hold/drag/touch) interactions
  let isDown = false;
  let px = 0,
    py = 0;

  canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    px = e.clientX - rect.left;
    py = e.clientY - rect.top;
    isDown = true;
    try {
      // Capture the pointer to continue receiving events even if the cursor leaves the canvas.
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    } catch (_) {}
    // immediate burst on down
    spawn(px, py, Number(countRange.value));
  });
  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    px = e.clientX - rect.left;
    py = e.clientY - rect.top;
  });

  function endPointer(e) {
    isDown = false;
    try {
      // Release the pointer capture when the interaction ends.
      canvas.releasePointerCapture && canvas.releasePointerCapture(e && e.pointerId);
    } catch (_) {}
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  /**
   * Represents a bone segment in a skeletal structure.
   * Each bone has a position (x, y), a length, an angle, and an optional parent bone.
   * Bones are used to create articulated creatures like snakes, dragons, and centipedes.
   * @param {number} x - The x coordinate of the bone.
   * @param {number} y - The y coordinate of the bone.
   */
  class Bone {
    constructor(x, y, parent = null, length = 20, angle = 0) {
      this.x = x;
      this.y = y;
      this.length = length;
      this.angle = angle;
      this.parent = parent;
    }

    update() {
      /**
       * Updates the bone's position based on its parent's position and angle.
       * If the bone has no parent, its position remains unchanged.
       */
      if (this.parent) {
        this.x = this.parent.x + Math.cos(this.angle) * this.length;
        this.y = this.parent.y + Math.sin(this.angle) * this.length;
      }
    }
  }

  // LimbSystem – for legs, claws, wings
   /**
   * Manages a system of connected bone segments forming a limb.
   * Used for creating legs, claws, and wings for creatures.
   * The limb segments are updated and drawn as a chain of connected bones.
   */
  class LimbSystem {
    constructor(parentBone, segments = 3, length = 25, side = 1, clawCount = 0) {
      this.parentBone = parentBone;
      this.segments = [];
      this.side = side;
      this.clawCount = clawCount;

      // build chain of limb segments
      let currentParent = parentBone;
      for (let i = 0; i < segments; i++) {
        const seg = new Bone(currentParent.x, currentParent.y, currentParent, length, 0);
        this.segments.push(seg);
        currentParent = seg;
      }
    }

    update(time, moveDist = 0) {
      /**
       * Updates each segment of the limb to have a base angle perpendicular to its parent, plus a sway.
       * @param {number} time - The current time in milliseconds.
       */
      // Update each segment to have a base angle perpendicular to its parent, plus a sway
      this.segments.forEach((seg, i) => {
        const parentAngle = seg.parent ? seg.parent.angle : 0;
        let baseAngle;

        if (i === 1) {
          baseAngle = parentAngle - this.side * 1.2;
          // Second segment bends inwards (knee/elbow)
        } else {
          const outwardAngle = (i === 0) ? Math.PI / 2 : -0.8; // First segment (hip/shoulder)
          baseAngle = parentAngle + this.side * outwardAngle;
        }
        //Wobble effect
        const wobbleStrength = Math.min(1, moveDist / 200); // Scale wobble with distance to cursor
        const sway = Math.sin(time / 400 + i * 0.5) * 0.25 * wobbleStrength; // Add life-like oscillation
        seg.angle = baseAngle + sway;
        seg.update();
      });
    }

    draw(ctx) {
      /**
       * Draws the limb on the canvas context.
       * Draws the bone segments and claws (if specified).
       */
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1.2;

      ctx.beginPath();
      this.segments.forEach((seg, i) => {
        if (i === 0) ctx.moveTo(seg.parent.x, seg.parent.y);
        ctx.lineTo(seg.x, seg.y);
      });
      ctx.stroke();

      // claws at the tip if specified
      if (this.clawCount > 0 && this.segments.length > 1) {
        const tip = this.segments[this.segments.length - 1];
        const prev = this.segments[this.segments.length - 2];
        const angle = Math.atan2(tip.y - prev.y, tip.x - prev.x);
        const clawLen = 12;
        for (let i = 0; i < this.clawCount; i++) {
          const spread = (i - (this.clawCount - 1) / 2) * 0.3;
          ctx.beginPath();
          ctx.moveTo(tip.x, tip.y);
          ctx.lineTo(
            tip.x + Math.cos(angle + spread) * clawLen,
            tip.y + Math.sin(angle + spread) * clawLen
          );
          ctx.stroke();
        }
      }
    }
  }

  // =================================================================
  // FORELIMB SYSTEM
  // =================================================================
  class ForeLimbSystem extends LimbSystem {
    /**
     * Adjusts the angles and sway of the forelimb segments.
     * Specific update logic for forelimbs.
     */
      // Specific update logic for forelimbs
    update(time, moveDist = 0) {
      this.segments.forEach((seg, i) => {
        const parentAngle = seg.parent ? seg.parent.angle : 0;
        let baseAngle;
        if (i === 1) {
           baseAngle = parentAngle - this.side * 1.0;
        } else {
          baseAngle = parentAngle + this.side * (i === 0 ? Math.PI / 2.0 : -0.9);
        }
        const wobbleStrength = Math.min(1, moveDist / 200);
        const sway = Math.sin(time / 400 + i * 0.5) * 0.25 * wobbleStrength;
        seg.angle = baseAngle + sway;
        seg.update();
      });
    }
  }
  // =================================================================
  // WING SYSTEM

  class WingSystem extends LimbSystem {
    /**
     * The wings flap with a sweeping motion, folding and fluttering in a coordinated manner.
     * Generates a flapping animation for wings.
     * The wings flap with a sweeping motion, folding and fluttering in a coordinated manner.
     */
    update(time, moveDist = 0) {
      const flapCycle = time / 600; // Slower, more majestic flap
      const flapAngle = Math.sin(flapCycle) * 1.4;

      this.segments.forEach((seg, i) => {
        const parentAngle = seg.parent ? seg.parent.angle : 0;
        let baseAngle;

        if (i === 0) {
          baseAngle = parentAngle + this.side * (Math.PI / 2.2 + flapAngle);
        } else {
          const fold = Math.sin(flapCycle + Math.PI / 2) * 0.6;
          baseAngle = parentAngle + this.side * (0.1 + fold);
        }
        
        const flutter = Math.sin(time / 100 + i) * 0.05 * Math.min(1, moveDist / 200);
        seg.angle = baseAngle + this.side * flutter;
        seg.update();
      });
    }

    draw(ctx) {
      /**
       * Draws the wing on the canvas context.
       * Draws the wing bones and the scalloped wing membrane.
       */
      // Draw the wing bones
      super.draw(ctx);

      // Draw the wing membrane
      ctx.fillStyle = 'rgba(180, 210, 255, 0.08)';
      ctx.strokeStyle = 'rgba(210, 230, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(this.parentBone.x, this.parentBone.y);

      // Draw a curved, scalloped membrane between the wing bones for a more realistic look.
      for (let i = 0; i < this.segments.length - 1; i++) {
        const p1 = this.segments[i];
        const p2 = this.segments[i + 1];
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
      }
      // Connect back to the root bone
      ctx.lineTo(this.segments[this.segments.length - 1].x, this.segments[this.segments.length - 1].y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  // =================================================================
  // HINDLIMB SYSTEM
  // =================================================================
    class HindLimbSystem extends LimbSystem {
    /**
     * Specific update logic for hindlimbs.
     * Adjusts the angles and sway of the hindlimb segments.
     */
    update(time, moveDist = 0) {
      // Specific update logic for hindlimbs
      this.segments.forEach((seg, i) => {
        const parentAngle = seg.parent ? seg.parent.angle : 0;
        let baseAngle;

        if (i === 1) {
          baseAngle = parentAngle - this.side * -1.1;
        } else {
          baseAngle = parentAngle + this.side * (i === 0 ? Math.PI / 2.0 : -1.0);
        }


        const wobbleStrength = Math.min(1, moveDist / 200);

        const sway = Math.sin(time / 400 + i * 0.5) * 0.25 * wobbleStrength;
        seg.angle = baseAngle + sway;
        seg.update();
      });
    }
  }

  // =================================================================
  // ENTITY CLASSES
  // =================================================================

  // =================================================================
  // SKELETAL ENTITY (BASE CLASS)
  // Provides common "follow-the-leader" mechanics for segmented creatures.
  // =================================================================
  class SkeletalEntity {
    constructor(config) {
      this.config = Object.assign({
        boneCount: 20,
        boneLength: 25,
        headAngleSmoothing: 8,
        headSpeed: { min: 1.5, max: 6.0, dist: 300 },
      }, config);
      this.bones = [];
      this.init();
    }

    init() {
      this.bones = [];
      const hx = Math.round(w / 2);
      const hy = Math.round(h / 2);
      for (let i = 0; i < this.config.boneCount; i++) {
        this.bones.push({
          x: hx - i * this.config.boneLength,
          y: hy,
          angle: 0
        });
      }
    }

    update(dt, px, py, speedVal) {
      const head = this.bones[0];
      const dx = px - head.x;
      const dy = py - head.y;
      const dist = Math.hypot(dx, dy) || 1;
      const targetAngle = Math.atan2(dy, dx);

      head.angle = angleLerp(head.angle, targetAngle, Math.min(1, dt * this.config.headAngleSmoothing));

      const moveSpeed = lerp(this.config.headSpeed.min, this.config.headSpeed.max, Math.min(1, dist / this.config.headSpeed.dist)) * speedVal;
      head.x += Math.cos(head.angle) * moveSpeed * Math.min(1, dt * 60);
      head.y += Math.sin(head.angle) * moveSpeed * Math.min(1, dt * 60);

      for (let i = 1; i < this.bones.length; i++) {
        const parent = this.bones[i - 1];
        const child = this.bones[i];
        const bdx = parent.x - child.x;
        const bdy = parent.y - child.y;
        const bTargetAngle = Math.atan2(bdy, bdx);

        child.x = parent.x - Math.cos(bTargetAngle) * this.config.boneLength;
        child.y = parent.y - Math.sin(bTargetAngle) * this.config.boneLength;
        child.angle = bTargetAngle;
      }
    }

    emitParticles() { /* Base implementation does nothing */ }
  }

  // =================================================================
  // FISH ENTITY
  // Defines a simple fish that swims towards the cursor.
  // =================================================================
  class Fish {
    /**
     * Represents a fish with the ability to swim towards the cursor.
     * The fish has a position, velocity, angle, size, and color.
     * It animates its fins and tail and emits bubble-like particles.
     */
    constructor() {
      this.x = w / 2;
      this.y = h / 2;
      this.vx = 0;
      this.vy = 0;
      this.angle = 0;
      this.size = 25;
      this.time = 0;
      this.hue = rand(180, 220);
    }

    update(dt, px, py, speedVal) {
      /**
       * Updates the fish's properties based on the provided parameters.
       * Moves the fish towards the cursor, smoothly rotating and accelerating.
       * @param {number} dt - The time delta in seconds.
       * @param {number} px - The x coordinate of the cursor.
       * @param {number} py - The y coordinate of the cursor.
       * @param {number} speedVal - A multiplier to adjust the fish's speed.
       */
      this.time += dt;
      const dx = px - this.x;
      const dy = py - this.y;
      const dist = Math.hypot(dx, dy) || 1;
      const targetAngle = Math.atan2(dy, dx);
      
      // Smoothly rotate towards the target angle.
      const angleDiff = ((targetAngle - this.angle + Math.PI) % (Math.PI * 2)) - Math.PI;
      this.angle += angleDiff * Math.min(1, dt * 4);

      // Accelerate towards the cursor, with more acceleration when further away.
      const acceleration = lerp(0.05, 0.3, Math.min(1, dist / 500)) * speedVal;
      this.vx += Math.cos(this.angle) * acceleration;
      this.vy += Math.sin(this.angle) * acceleration;

      // friction
      this.vx *= 0.96;
      this.vy *= 0.96;

      this.x += this.vx * Math.min(1, dt * 60);
      this.y += this.vy * Math.min(1, dt * 60);
    }

    draw(ctx) {
      /**
       * Draws the fish on the canvas context.
       * Uses procedural animation for fins and tail and a radial gradient for the body.
       */
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);

      // Procedural animation for fins and tail based on time.
      const bodySway = Math.sin(this.time * 15) * 0.1;

      // Dorsal Fin
      ctx.fillStyle = `hsla(${this.hue + 10}, 70%, 40%, 0.8)`;
      ctx.beginPath();
      ctx.moveTo(-this.size * 0.1, -this.size * 0.3);
      ctx.quadraticCurveTo(
        -this.size * 0.3, -this.size * 0.6 + bodySway * this.size * 0.5,
        -this.size * 0.6, -this.size * 0.2 + bodySway * this.size * 0.2
      );
      ctx.closePath();
      ctx.fill();


      const tailSway = Math.sin(this.time * 25) * 0.4;

      // Tail
      ctx.fillStyle = `hsl(${this.hue + 20}, 80%, 50%)`;
      ctx.beginPath();
      ctx.moveTo(-this.size * 0.8, 0);
      ctx.quadraticCurveTo(-this.size * 1.2, -this.size * 0.5 + tailSway * this.size, -this.size * 1.5, tailSway * this.size * 0.4);
      ctx.quadraticCurveTo(-this.size * 1.2, this.size * 0.5 + tailSway * this.size, -this.size * 0.8, 0);
      ctx.fill();

      // Body with a radial gradient to give it a 3D look.
      const bodyGrad = ctx.createRadialGradient(0, 0, this.size * 0.2, 0, 0, this.size * 1.2);
      bodyGrad.addColorStop(0, `hsl(${this.hue}, 90%, 75%)`);
      bodyGrad.addColorStop(1, `hsl(${this.hue}, 90%, 55%)`);
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, this.size, this.size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Eye with a small highlight for a more lively look.
      const eyeX = this.size * 0.5;
      const eyeY = 0;
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(eyeX, eyeY, this.size * 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'black';
      ctx.beginPath();
      ctx.arc(eyeX + this.size * 0.05, eyeY, this.size * 0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(eyeX + this.size * 0.02, eyeY - this.size * 0.02, this.size * 0.05, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    emitParticles(dt) {
      /**
       * Emits bubble-like particles from behind the fish.
       * The particles have a random size, lifespan, and hue.
       */
      // Occasionally emit bubble-like particles from behind the fish.
      if (Math.random() < Math.min(0.5, dt * 60 * 0.2)) {
        const angle = this.angle + Math.PI + rand(-0.2, 0.2);
        const speed = rand(0.2, 1.0);
        particles.push(new Particle(this.x, this.y, {
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: rand(1, 4),
          life: rand(40, 100),
          hue: rand(180, 220)
        }));
      }
    }
  }
  // =================================================================
  // END OF FISH ENTITY
  // =================================================================

  // =================================================================
  // KOI ENTITY
  // Extends the Fish class with different colors, patterns, and a larger size.
  // =================================================================
class Koi extends Fish {
    /**
     * Extends the Fish class with unique colors, patterns, and size.
     */
    constructor() {
      super();
      this.size = 35;
      this.hue = rand(0, 50); // Oranges and reds for a koi look.
    }

    draw(ctx) {
      /**
       * Draws the Koi on the canvas context.
       * Uses unique colors, patterns, and bezier curves to create organic-looking spots.
       */
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);

      const bodySway = Math.sin(this.time * 15) * 0.1;

      // Dorsal Fin
      ctx.fillStyle = `hsla(${this.hue + 5}, 70%, 50%, 0.8)`;
      ctx.beginPath();
      ctx.moveTo(-this.size * 0.1, -this.size * 0.4);
      ctx.quadraticCurveTo(
        -this.size * 0.3, -this.size * 0.7 + bodySway * this.size * 0.5,
        -this.size * 0.6, -this.size * 0.3 + bodySway * this.size * 0.2
      );
      ctx.closePath();
      ctx.fill();

      const tailSway = Math.sin(this.time * 20) * 0.5;

      // Tail
      ctx.fillStyle = `hsl(${this.hue + 10}, 80%, 60%)`;
      ctx.beginPath();
      ctx.moveTo(-this.size * 0.7, 0);
      ctx.quadraticCurveTo(-this.size * 1.4, -this.size * 0.6 + tailSway * this.size, -this.size * 1.8, tailSway * this.size * 0.3);
      ctx.quadraticCurveTo(-this.size * 1.4, this.size * 0.6 + tailSway * this.size, -this.size * 0.7, 0);
      ctx.fill();

      // Body
      const bodyGrad = ctx.createRadialGradient(0, 0, this.size * 0.2, 0, 0, this.size * 1.2);
      bodyGrad.addColorStop(0, `hsl(${this.hue}, 95%, 80%)`);
      bodyGrad.addColorStop(1, `hsl(${this.hue}, 95%, 60%)`);
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, this.size, this.size * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw organic-looking spots using bezier curves.
      ctx.fillStyle = `hsla(${this.hue - 20}, 90%, 30%, 0.8)`;
      // More organic spots
      ctx.beginPath();
      ctx.moveTo(this.size * 0.4, this.size * 0.2);
      ctx.bezierCurveTo(this.size * 0.5, -this.size * 0.1, this.size * 0.1, -this.size * 0.3, -this.size * 0.1, -this.size * 0.1);
      ctx.bezierCurveTo(-this.size * 0.3, this.size * 0.1, this.size * 0.2, this.size * 0.4, this.size * 0.4, this.size * 0.2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-this.size * 0.5, this.size * 0.3);
      ctx.bezierCurveTo(-this.size * 0.8, this.size * 0.1, -this.size * 0.8, -this.size * 0.3, -this.size * 0.6, -this.size * 0.2);
      ctx.bezierCurveTo(-this.size * 0.4, -this.size * 0.1, -this.size * 0.3, this.size * 0.4, -this.size * 0.5, this.size * 0.3);
      ctx.fill();

      // Eye
      const eyeX = this.size * 0.6;
      const eyeY = 0;
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(eyeX, eyeY, this.size * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'black';
      ctx.beginPath();
      ctx.arc(eyeX + this.size * 0.05, eyeY, this.size * 0.07, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }
  // =================================================================
  // END OF KOI ENTITY
  // =================================================================

  // =================================================================
  // CENTIPEDE ENTITY
  // Defines a multi-segmented creature with legs that follows the cursor.
  // =================================================================
  class Centipede extends SkeletalEntity {
    /**
     * Represents a multi-segmented centipede that follows the cursor.
     * The centipede has a variable number of bones, each with a length and angle.
     * It animates its legs and antennae and emits no particles.
     */
    constructor() {
      super({
        boneCount: 40,
        boneLength: 12,
        headAngleSmoothing: 10,
      });
    }

    draw(ctx) {
      /**
       * Draws the centipede on the canvas context.
       * Uses gradients and procedural animation to create a wiggly, realistic appearance.
       */
      const time = performance.now() / 1000;
      for (let i = 1; i < this.bones.length; i++) {
        const b = this.bones[i];
        const t = i / this.bones.length;

        // Body segment
        const grad = ctx.createRadialGradient(b.x, b.y, 1, b.x, b.y, this.config.boneLength * 0.7);
        grad.addColorStop(0, `hsl(30, 50%, ${lerp(50, 35, t)}%)`);
        grad.addColorStop(1, `hsl(30, 50%, ${lerp(30, 15, t)}%)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(b.x, b.y, lerp(this.config.boneLength * 0.6, this.config.boneLength * 0.2, t), 0, Math.PI * 2);
        ctx.fill();

        // Procedurally animate legs to wiggle as the centipede moves.
        const legLength = this.config.boneLength * 1.4;
        const legWiggle = Math.sin(time * 40 - i * 0.5);
        const pxp = -Math.sin(b.angle);
        const pyp = Math.cos(b.angle);

        ctx.strokeStyle = `hsl(30, 40%, 15%)`;
        ctx.lineWidth = 2;
        
        // Draw two-segment, jointed legs for a more realistic look.
        for (let side = -1; side <= 1; side += 2) {
          const jointAngle = b.angle + side * 1.2 + legWiggle * 0.5;
          const jointX = b.x + Math.cos(jointAngle) * legLength * 0.5;
          const jointY = b.y + Math.sin(jointAngle) * legLength * 0.5;
          const tipAngle = b.angle + side * 1.0 + legWiggle * 0.8;
          const tipX = jointX + Math.cos(tipAngle) * legLength * 0.6;
          const tipY = jointY + Math.sin(tipAngle) * legLength * 0.6;

          ctx.beginPath();
          ctx.moveTo(b.x, b.y);
          ctx.lineTo(jointX, jointY);
          ctx.lineTo(tipX, tipY);
          ctx.stroke();
        }
      }

      // Head
      const head = this.bones[0];
      const headGrad = ctx.createRadialGradient(head.x, head.y, 2, head.x, head.y, this.config.boneLength);
      headGrad.addColorStop(0, 'hsl(30, 60%, 60%)');
      headGrad.addColorStop(1, 'hsl(30, 60%, 40%)');
      ctx.fillStyle = headGrad;
      ctx.beginPath();
      ctx.arc(head.x, head.y, this.config.boneLength * 0.8, 0, Math.PI * 2);
      ctx.fill();
      
      // Add wiggling antennae to the head.
      const antennaWiggle = Math.sin(time * 20) * 0.4;
      ctx.strokeStyle = 'hsl(30, 40%, 10%)';
      ctx.lineWidth = 1.5;
      for (let side = -1; side <= 1; side += 2) {
        const ang = head.angle - side * 0.5 + antennaWiggle * side * 0.3;
        ctx.beginPath();
        ctx.moveTo(head.x, head.y);
        ctx.lineTo(head.x + Math.cos(ang) * this.config.boneLength * 1.5, head.y + Math.sin(ang) * this.config.boneLength * 1.5);
        ctx.stroke();
      }

      ctx.fillStyle = 'black';
      ctx.beginPath();
      ctx.arc(head.x + Math.cos(head.angle) * 4, head.y + Math.sin(head.angle) * 4, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // =================================================================
  // END OF CENTIPEDE ENTITY
  // =================================================================

  // =================================================================
  // SNAKE ENTITY
  // This class defines the behavior and appearance of the snake.
  // It manages the skeleton, movement, and rendering of the creature.
  // =================================================================
  class Snake extends SkeletalEntity {
    /**
     * Manages the behavior and appearance of the snake.
     * Manages the skeleton, movement, and rendering of the creature.
     */
    constructor(config = {}) {
      this.config = Object.assign({
        boneCount: 22,
        boneLength: 26,
        glowHue: 190,
        glowHueRange: 60,
        ribWobbleAmp: 2,
        mouthIdleSpeed: 0.003,
      }, config);

      super({
        boneCount: this.config.boneCount,
        boneLength: this.config.boneLength,
        headSpeed: { min: 0.5, max: 4.5, dist: 400 }
      });
    }

    draw(ctx, px, py) {
      /**
       * Draws the snake on the canvas context.
       * Uses a spine polyline, vertebrae, ribs, and a head with a skull, mouth, teeth, and eyes.
       */
      const bones = this.bones;
      const boneLength = this.config.boneLength;

      // === Spine polyline ===
      const path = new Path2D();
      for (let i = 0; i < bones.length; i++) {
        const b = bones[i];
        if (i === 0) path.moveTo(b.x, b.y);
        else path.lineTo(b.x, b.y);
      }

      // The spine's glow hue shifts over time for a dynamic effect.
      const hueShift = (performance.now() / 50) % this.config.glowHueRange;
      const glowHue = (this.config.glowHue + hueShift) % 360;

      ctx.strokeStyle = 'rgba(240,240,240,0.12)';
      ctx.lineWidth = 2.0;
      ctx.lineJoin = 'round';
      ctx.stroke(path);

      // A second pass to draw the glow, which pulses in size.
      const glowPulse = 0.5 + (Math.sin(performance.now() / 400) + 1) * 0.25;
      ctx.shadowColor = `hsla(${glowHue}, 100%, 70%, 0.4)`;
      ctx.shadowBlur = 15 * glowPulse;
      ctx.strokeStyle = `hsla(${glowHue}, 100%, 75%, 0.3)`;
      ctx.lineWidth = 4;
      ctx.stroke(path);

      // Reset
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.lineWidth = 1.0;

      // === Vertebrae: Draw small ellipses along the spine. ===
      for (let i = 1; i < bones.length; i++) {
        const b = bones[i];
        const t = i / bones.length;
        const rx = lerp(boneLength * 0.5, boneLength * 0.22, t);
        const ry = lerp(boneLength * 0.22, boneLength * 0.08, t);
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.angle);
        const vertGrad = ctx.createLinearGradient(-rx, -ry, rx, ry);
        const alpha = lerp(0.95, 0.25, t);
        vertGrad.addColorStop(0, `rgba(255,255,255,${alpha})`);
        vertGrad.addColorStop(1, `rgba(220,220,230,${alpha * 0.8})`);
        ctx.fillStyle = vertGrad;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx * 0.4, ry * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // === Ribs: Draw curved ribs that have a subtle "breathing" wobble. ===
      for (let i = 1; i < bones.length; i++) {
        const b = bones[i];
        const t = i / bones.length;
        const ux = Math.cos(b.angle);
        const uy = Math.sin(b.angle);
        const pxp = -uy;
        const pyp = ux;

        // The wobble is a sine wave based on time and the bone's index.
        const wobble = Math.sin(performance.now() / 250 + i * 0.5) * this.config.ribWobbleAmp;
        const ribLen = lerp(boneLength * 0.5, boneLength * 0.18, t) + wobble;
        const alpha = lerp(0.9, 0.1, t); // fade tail stronger
        ctx.strokeStyle = `rgba(245,245,245,${alpha})`;
        ctx.lineWidth = Math.max(0.7, 1.0 - t * 0.6);

        const sx = b.x;
        const sy = b.y;
        // Left rib
        const lx = sx - pxp * (2 + ribLen);
        const ly = sy - pyp * (2 + ribLen);
        const c1x = sx - pxp * (ribLen * 0.6) - ux * (ribLen * 0.4);
        const c1y = sy - pyp * (ribLen * 0.6) - uy * (ribLen * 0.4);
        ctx.beginPath();
        ctx.moveTo(sx - pxp * 2, sy - pyp * 2);
        ctx.quadraticCurveTo(c1x, c1y, lx, ly);
        ctx.stroke();

        // Right rib
        const rx = sx + pxp * (2 + ribLen);
        const ry = sy + pyp * (2 + ribLen);
        const c2x = sx + pxp * (ribLen * 0.6) - ux * (ribLen * 0.4);
        const c2y = sy + pyp * (ribLen * 0.6) - uy * (ribLen * 0.4);
        ctx.beginPath();
        ctx.moveTo(sx + pxp * 2, sy + pyp * 2);
        ctx.quadraticCurveTo(c2x, c2y, rx, ry);
        ctx.stroke();
      }

      // === Head: Draw the skull, mouth, teeth, and eyes. ===
      const head = this.bones[0];
      const dxh = px - head.x;
      const dyh = py - head.y;
      const distH = Math.hypot(dxh, dyh) || 1;

      // Mouth opening is a combination of an idle "hiss" and opening wider when the cursor is close.
      const idle = (Math.sin(performance.now() * this.config.mouthIdleSpeed) + 1) * 0.5;
      const openH = Math.max(0, Math.min(1, 1 - distH / 200)) + idle * 0.3;

      ctx.save();
      ctx.translate(head.x, head.y);
      ctx.rotate(head.angle);

      // Skull
      ctx.fillStyle = '#f0f4f8';
      ctx.beginPath();
      ctx.ellipse(0, 0, boneLength * 0.7, boneLength * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Mouth
      ctx.fillStyle = '#071028';
      ctx.beginPath();
      const mouthW = boneLength * 0.9;
      const mouthH = boneLength * 0.22 + openH * 10;
      ctx.moveTo(-mouthW * 0.45, 0);
      ctx.quadraticCurveTo(-mouthW * 0.2, mouthH, mouthW * 0.35, openH * 6);
      ctx.quadraticCurveTo(-mouthW * 0.2, -mouthH, -mouthW * 0.45, 0);
      ctx.closePath();
      ctx.fill();

      // Draw simple triangular teeth inside the mouth.
      ctx.fillStyle = 'rgba(245,245,245,0.95)';
      const teeth = 6;
      for (let i = 0; i < teeth; i++) {
        const tx = -boneLength * 0.18 + i * (boneLength * 0.12);
        // lower
        ctx.beginPath();
        ctx.moveTo(tx, 6 + openH * 6);
        ctx.lineTo(tx + 3, 2 + openH * 4);
        ctx.lineTo(tx - 3, 2 + openH * 4);
        ctx.closePath();
        ctx.fill();
        // upper
        ctx.beginPath();
        ctx.moveTo(tx, -6 - openH * 6);
        ctx.lineTo(tx + 3, -2 - openH * 4);
        ctx.lineTo(tx - 3, -2 - openH * 4);
        ctx.closePath();
        ctx.fill();
      }

      // Eyes that glow and track the cursor's position.
      const eyeAngle = Math.atan2(dyh, dxh) - head.angle;
      const eyeDist = Math.min(boneLength * 0.1, distH * 0.05);
      const ex = Math.cos(eyeAngle) * eyeDist;
      const ey = Math.sin(eyeAngle) * eyeDist;
      ctx.fillStyle = `hsl(${glowHue}, 100%, 70%)`;
      ctx.shadowColor = `hsl(${glowHue}, 100%, 70%)`;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(boneLength * 0.2 + ex, -boneLength * 0.22 + ey, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(boneLength * 0.2 + ex, boneLength * 0.22 + ey, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // Refactored emitParticles to use a config object for parameters
    emitParticles(dt) {
      const { bones, config } = this;
      if (!bones || particles.length > config.maxParticles) return;

      const particleConfig = {
        emissionRate: 0.4, //Base emission rate
        speed: {min: 0.2, max: 1.2}, //Base speed range
        size: {min: 0.6, max: 1.8}, //Base size range
        life: {min: 30, max: 90}, //Base life range
        hue: {min: 10, max: 50}, //Base hue range
      };

      const chance = Math.min(0.6, dt * 60 * particleConfig.emissionRate);
      for (let i = 0; i < this.bones.length; i += 3) {
        if (Math.random() < chance) {
          const b = this.bones[i];
          const ang = b.angle + (Math.random() - 0.5) * 0.3;
          const speed = rand(particleConfig.speed.min, particleConfig.speed.max);
          const vx = Math.cos(ang) * speed * (0.5 + (1 - i / this.bones.length));
          const vy = Math.sin(ang) * speed * (0.5 + (1 - i / this.bones.length));
          const size = rand(particleConfig.size.min, particleConfig.size.max);
          const life = rand(particleConfig.life.min, particleConfig.life.max);
          const hue = rand(particleConfig.hue.min, particleConfig.hue.max);
          particles.push(new Particle(b.x + rand(-2, 2), b.y + rand(-2, 2), {
            vx, vy, size, life, hue
          }));
        }
      }
    }
  }

// =================================================================
// END OF SNAKE ENTITY
// =================================================================

// =================================================================
// DRAGON ENTITY
// A standalone class for the dragon, with its own skeleton, limbs, and rendering.
// =================================================================
class Dragon extends SkeletalEntity {
  /**
   * Represents a dragon with its own skeleton, limbs, and rendering.
   * Manages the dragon's bones, ribs, limbs, and wings.
   */
  constructor(config = {}) {
    this.config = Object.assign({
      boneCount: 45,
      boneLength: 28,
      glowHue: 190,
      glowHueRange: 60,
      ribWobbleAmp: 2,
      mouthIdleSpeed: 0.003,
      maxParticles: 1500,
      followDelay: 0.08, // Smooth following delay (lower = faster response)
    }, config);

    super({
      boneCount: this.config.boneCount,
      boneLength: this.config.boneLength,
      headAngleSmoothing: 1 / this.config.followDelay / 60, // Convert delay to smoothing factor
      headSpeed: { min: 1.5, max: 8.0, dist: 500 } // Custom speed for dragon
    });

    this.limbs = [];
    this.wings = [];
    this.init();
  }

  init() {
    // The super() call in the constructor now handles bone initialization.
    // We only need to initialize the limbs and wings here.

    // Limbs and Wings
    this.limbs = [
      new LimbSystem(this.bones[6], 3, 25, 1, 3),
      new ForeLimbSystem(this.bones[6], 3, 25, -1, 3),
      new HindLimbSystem(this.bones[25], 3, 25, 1, 3),
      new HindLimbSystem(this.bones[25], 3, 25, -1, 3),
    ];

    this.wings = [
      new WingSystem(this.bones[7], 5, 30, 1, 0),
      new WingSystem(this.bones[7], 5, 30, -1, 0),
    ];
  }

  update(dt, px, py, speedVal) {
    // First, call the parent update method to move the spine
    super.update(dt, px, py, speedVal);

    const time = performance.now();
    const head = this.bones[0];

    // Head movement
    const dx = px - head.x;
    const dy = py - head.y;
    const dist = Math.hypot(dx, dy);

    // Update ribs, limbs, and wings
    this.limbs.forEach(l => l.update(time, dist));
    this.wings.forEach(w => w.update(time, dist));
  }

  draw(ctx, px, py) {
    const { bones, config } = this;
    const { boneLength, glowHue, glowHueRange } = config;

    const time = performance.now();
    const hueShift = (time / 50) % glowHueRange;
    const currentHue = (glowHue + hueShift) % 360;

    // === Spine ===
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.bones[0].x, this.bones[0].y);
    this.bones.forEach(b => ctx.lineTo(b.x, b.y));
    ctx.stroke();

    // === Ribs (Copied from Snake class) ===
    for (let i = 1; i < bones.length; i++) {
      const b = bones[i];
      const t = i / bones.length;
      const ux = Math.cos(b.angle);
      const uy = Math.sin(b.angle);
      const pxp = -uy;
      const pyp = ux;

      const wobble = Math.sin(performance.now() / 250 + i * 0.5) * config.ribWobbleAmp;
      const ribLen = lerp(boneLength * 0.6, boneLength * 0.2, t) + wobble;
      const alpha = lerp(0.9, 0.1, t);
      ctx.strokeStyle = `rgba(245,245,245,${alpha})`;
      ctx.lineWidth = Math.max(0.8, 1.2 - t * 0.7);

      const sx = b.x;
      const sy = b.y;
      // Left rib
      const lx = sx - pxp * (2 + ribLen);
      const ly = sy - pyp * (2 + ribLen);
      const c1x = sx - pxp * (ribLen * 0.6) - ux * (ribLen * 0.4);
      const c1y = sy - pyp * (ribLen * 0.6) - uy * (ribLen * 0.4);
      ctx.beginPath();
      ctx.moveTo(sx - pxp * 2, sy - pyp * 2);
      ctx.quadraticCurveTo(c1x, c1y, lx, ly);
      ctx.stroke();

      // Right rib
      const rx = sx + pxp * (2 + ribLen);
      const ry = sy + pyp * (2 + ribLen);
      const c2x = sx + pxp * (ribLen * 0.6) - ux * (ribLen * 0.4);
      const c2y = sy + pyp * (ribLen * 0.6) - uy * (ribLen * 0.4);
      ctx.beginPath();
      ctx.moveTo(sx + pxp * 2, sy + pyp * 2);
      ctx.quadraticCurveTo(c2x, c2y, rx, ry);
      ctx.stroke();
    }

    // === Limbs ===
    this.limbs.forEach(l => l.draw(ctx));

    // === Wings ===
    this.wings.forEach(w => w.draw(ctx));

    // === Head ===
    this.drawSkull(ctx, px, py, currentHue);
  }

  drawSkull(ctx, px, py, glowHue) {
    const { bones, config } = this;
    const { boneLength } = config;
    const head = bones[0];

    ctx.save();
    ctx.translate(head.x, head.y);
    ctx.rotate(head.angle);

    // Draw a stylized, black dragon head based on the reference image.
    ctx.fillStyle = 'black';
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.8)';
    ctx.lineWidth = 1;

    // Main head shape
    ctx.beginPath();
    ctx.moveTo(boneLength * 0.6, 0);
    ctx.lineTo(boneLength * 0.2, -boneLength * 0.5);
    ctx.lineTo(-boneLength * 0.5, -boneLength * 0.3);
    ctx.lineTo(-boneLength * 0.5, boneLength * 0.3);
    ctx.lineTo(boneLength * 0.2, boneLength * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Open mouth
    const dxh = px - head.x;
    const dyh = py - head.y;
    const distH = Math.hypot(dxh, dyh) || 1;
    const idle = (Math.sin(performance.now() * config.mouthIdleSpeed) + 1) * 0.5;
    const openFactor = Math.max(0, Math.min(1, 1 - distH / 200)) + idle * 0.3;
    ctx.beginPath();
    ctx.moveTo(-boneLength * 0.2, 0);
    ctx.lineTo(boneLength * 0.5, openFactor * 6);
    ctx.lineTo(boneLength * 0.5, -openFactor * 6);
    ctx.closePath();
    ctx.fillStyle = '#070e20';
    ctx.fill();

    // Horns/spikes
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-boneLength * 0.5, -boneLength * 0.3);
    ctx.lineTo(-boneLength * 0.7, -boneLength * 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-boneLength * 0.5, boneLength * 0.3);
    ctx.lineTo(-boneLength * 0.7, boneLength * 0.6);
    ctx.stroke();

    ctx.restore();
  }

  emitParticles(dt) {
    const { bones, config } = this;
    if (!bones || particles.length > config.maxParticles) return;

    const chance = Math.min(0.8, dt * 60 * 0.6); // Increased chance for a denser trail

    // Start emitting from the middle of the body to create a tail trail
    for (let i = 15; i < this.bones.length; i += 2) {
      if (Math.random() >= chance) continue;

      const b = bones[i];
      const ang = b.angle + (Math.random() - 0.5) * 0.3;
      const speed = rand(0.2, 1.2);

      const vx = Math.cos(ang) * speed * (0.2 + (1 - i / bones.length));
      const vy = Math.sin(ang) * speed * (0.2 + (1 - i / bones.length));

      particles.push(new Particle(
        b.x + rand(-2, 2),
        b.y + rand(-2, 2), {
          vx,
          vy,
          size: rand(1.0, 2.5), // Slightly larger particles
          life: rand(40, 100), // Slightly longer life
          hue: rand(20, 50)
        }
      ));
    }
  }
}
// =================================================================
// END OF DRAGON ENTITY
// =================================================================


  // initial background particles
  for (let i = 0; i < 80; i++) spawn(rand(0, w), rand(0, h), 1);

  // main loop
  let last = performance.now();
  // spawn accumulator controls continuous spawn while holding pointer
  let spawnAcc = 0;
  const baseSpawnPerSecond = 200; // this will be scaled by count slider and limited

  // =================================================================
  // ENTITY MANAGEMENT
  // =================================================================
  // This section handles switching between different creatures (Snake, Dragon, etc.)
  // based on the UI dropdown selection.
  // =================================================================
  let activeEntity = null;
  const entityTypes = {
    snake: Snake,
    fish: Fish,
    koi: Koi,
    centipede: Centipede,
    dragon: Dragon,
  };

  function switchEntity() {
    const type = entitySelect.value;
    if (entityTypes[type]) {
      try {
        activeEntity = new entityTypes[type]();
      } catch (e) {
        console.error("Failed to create entity:", type, e);
        activeEntity = null; // Ensure activeEntity is null to prevent further errors
        alert("Error creating " + type + ". See console for details."); // Notify user
      }
    } else {
      activeEntity = null;
    }
  }
  // Listen for changes on the dropdown and switch the active entity
  entitySelect.addEventListener('change', switchEntity);
  switchEntity(); // Initialize with the default selected entity

  function loop(now) {
    const dt = (now - last) / 1000;
    last = now;

    // Clear the canvas with a low-alpha fill to create motion trails.
    ctx.fillStyle = 'rgba(8,12,20,0.18)';
    ctx.fillRect(0, 0, w, h);


    const speed = Number(speedRange.value);

    // continuous spawn while pointer held (particles)
    if (isDown) {
      const targetPerSecond = Math.min(1000, baseSpawnPerSecond * (Number(countRange.value) / 50));
      spawnAcc += targetPerSecond * dt;
      while (spawnAcc >= 1) {
        spawn(px + rand(-6, 6), py + rand(-6, 6), 1);
        spawnAcc -= 1;
      }
    } else {
      spawnAcc = Math.max(0, spawnAcc - 100 * dt);
    }

    // Update and remove dead particles.
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.update(speed);
      if (p.life <= 0 || p.x < -60 || p.x > w + 60 || p.y < -60 || p.y > h + 60) particles.splice(i, 1);
    }

    // Update the currently active entity.
    if (activeEntity) {
      activeEntity.update(dt, px, py, speed);
    }


    // Draw particles first, so they appear behind the entity.
    for (let i = 0; i < particles.length; i++) particles[i].draw(ctx);

    if (activeEntity) {
      activeEntity.draw(ctx, px, py);
      if (activeEntity.emitParticles) {
        activeEntity.emitParticles(dt);
      }
    }

    requestAnimationFrame(loop);
  }

  // fill screen initially
  ctx.fillStyle = '#071028';
  ctx.fillRect(0, 0, w, h);
  loop(performance.now());

})();
