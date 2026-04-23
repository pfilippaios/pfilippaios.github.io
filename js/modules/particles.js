(function initHoopRushParticles(global) {
  const HoopRushModules = global.HoopRushModules || (global.HoopRushModules = {});

  function createParticlesSystem({ ctx }) {
    const particles = [];

    function spawnPuff(x, y, count = 12, color = "rgba(255, 255, 255, 0.7)") {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.5 + Math.random() * 2.5;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1.0,
          decay: 0.02 + Math.random() * 0.03,
          size: 4 + Math.random() * 12,
          color,
          type: "puff",
        });
      }
    }

    function spawnStars(x, y, count = 8) {
      const colors = ["#FFD700", "#FF69B4", "#00FF7F", "#00BFFF", "#FF4500"];
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.0 + Math.random() * 3.5;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1.0,
          decay: 0.015 + Math.random() * 0.02,
          size: 3 + Math.random() * 5,
          color: colors[Math.floor(Math.random() * colors.length)],
          type: "star",
          angle: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 0.2,
        });
      }
    }

    function update() {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05; // Light gravity
        p.life -= p.decay;
        if (p.type === "star") p.angle += p.spin;
        if (p.life <= 0) particles.splice(i, 1);
      }
    }

    function draw() {
      ctx.save();
      for (const p of particles) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        if (p.type === "star") {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          const s = p.size;
          ctx.beginPath();
          ctx.moveTo(0, -s);
          ctx.lineTo(s * 0.3, -s * 0.3);
          ctx.lineTo(s, 0);
          ctx.lineTo(s * 0.3, s * 0.3);
          ctx.lineTo(0, s);
          ctx.lineTo(-s * 0.3, s * 0.3);
          ctx.lineTo(-s, 0);
          ctx.lineTo(-s * 0.3, -s * 0.3);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1 + (1 - p.life)), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    return {
      spawnPuff,
      spawnStars,
      update,
      draw,
    };
  }

  HoopRushModules.particles = {
    createParticlesSystem,
  };
})(window);
