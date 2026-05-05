// Particle System
class Particle {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.velocity = Math.random() * 0.5 + 0.2;
        this.size = Math.random() * 2 + 1;
        this.opacity = Math.random() * 0.5 + 0.1;
    }

    update() {
        this.y -= this.velocity;
        if (this.y < 0) {
            this.y = this.canvas.height;
            this.x = Math.random() * this.canvas.width;
        }
    }

    draw() {
        this.ctx.beginPath();
        this.ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(255, 65, 3, ${this.opacity})`;
        this.ctx.fill();
    }
}

const initParticles = () => {
    const canvas = document.getElementById('canvas-particles');
    const ctx = canvas.getContext('2d');
    let particles = [];

    const resize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        particles = [];
        for (let i = 0; i < 100; i++) {
            particles.push(new Particle(canvas));
        }
    };

    window.addEventListener('resize', resize);
    resize();

    const animate = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.update();
            p.draw();
        });
        requestAnimationFrame(animate);
    };

    animate();
};

// Form Logic
const initForm = () => {
    const toggleBtns = document.querySelectorAll('.toggle-btn');
    const formTitle = document.getElementById('form-title');
    const formValueProp = document.getElementById('form-value-prop');
    const dynamicFields = document.getElementById('dynamic-fields');
    const submitBtn = document.getElementById('submit-btn');
    const waitlistForm = document.getElementById('waitlist-form');

    let currentMode = 'customer';

    const updateForm = (mode) => {
        currentMode = mode;
        toggleBtns.forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-mode="${mode}"]`).classList.add('active');

        if (mode === 'customer') {
            formTitle.textContent = 'Únete a la lista exclusiva';
            formValueProp.textContent = 'Sé de los primeros 100 y obtén beneficios exclusivos en el lanzamiento.';
            submitBtn.textContent = 'Registrarme ahora';
            dynamicFields.innerHTML = `
                <div class="input-group">
                    <label>Nombre completo</label>
                    <input type="text" name="name" placeholder="Ej. Juan Pérez" required>
                </div>
                <div class="input-group">
                    <label>Correo electrónico</label>
                    <input type="email" name="email" placeholder="juan@ejemplo.com" required>
                </div>
                <div class="input-group">
                    <label>Teléfono</label>
                    <input type="tel" name="phone" placeholder="833 000 0000" required>
                </div>
            `;
        } else {
            formTitle.textContent = 'Registra tu negocio';
            formValueProp.textContent = 'Recibe prioridad en el posicionamiento y beneficios de lanzamiento.';
            submitBtn.textContent = 'Enviar solicitud';
            dynamicFields.innerHTML = `
                <div class="input-group">
                    <label>Nombre del Negocio</label>
                    <input type="text" name="bizName" placeholder="Ej. Tacos El Güero" required>
                </div>
                <div class="input-group">
                    <label>Email de Contacto</label>
                    <input type="email" name="email" placeholder="contacto@negocio.com" required>
                </div>
                <div class="input-group">
                    <label>Teléfono</label>
                    <input type="tel" name="phone" placeholder="833 000 0000" required>
                </div>
                <div class="input-group">
                    <label>Tipo de Negocio</label>
                    <select name="bizType" required>
                        <option value="restaurante">Restaurante</option>
                        <option value="comercio">Comercio / Tienda</option>
                        <option value="otro">Otro</option>
                    </select>
                </div>
            `;
        }
    };

    toggleBtns.forEach(btn => {
        btn.addEventListener('click', () => updateForm(btn.dataset.mode));
    });

    waitlistForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(waitlistForm);
        const data = Object.fromEntries(formData.entries());
        data.type = currentMode;

        submitBtn.disabled = true;
        submitBtn.textContent = 'Procesando...';

        try {
            const response = await fetch('/api/waitlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                document.querySelector('.form-container').innerHTML = `
                    <div style="text-align: center; padding: 2rem;">
                        <div style="font-size: 4rem; margin-bottom: 1rem;">🎉</div>
                        <h3 style="font-size: 2rem; margin-bottom: 1rem;">¡Lugar asegurado!</h3>
                        <p style="color: var(--text-dim); margin-bottom: 2rem;">Tu lugar en la lista está asegurado. Mantente atento a tu correo 👀.</p>
                        <button class="btn btn-primary" onclick="location.reload()">Volver</button>
                    </div>
                `;
            } else {
                throw new Error('Error al registrar');
            }
        } catch (error) {
            alert('Hubo un problema. Por favor intenta de nuevo.');
            submitBtn.disabled = false;
            submitBtn.textContent = currentMode === 'customer' ? 'Inscribirme a la lista de espera' : 'Solicitar registro de mi negocio';
        }
    });
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initParticles();
    initForm();

    // Fade in effect for sections
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in');
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('section, .feature-card').forEach(section => {
        observer.observe(section);
    });
});
