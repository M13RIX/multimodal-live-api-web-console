const canvas = document.getElementById('visualizerCanvas');
const ctx = canvas.getContext('2d');
const pupilGlow = document.getElementById('pupil-glow');
const youtubePlayerContainer = document.getElementById('youtube-player-container');
const youtubeIframe = document.getElementById('youtube-iframe');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let centerX = canvas.width / 2;
let centerY = canvas.height / 2;
const baseRadius = Math.min(centerX, centerY) * 0.5;
const numCircles = 8;
const maxOffset = 13;
const baseHue = 210;
const hueVariation = 30;
let glowIntensity = 18;
let targetGlowIntensity = 18; // Целевая интенсивность свечения
const glowSmoothFactor = 0.1; // Фактор сглаживания для свечения

let aiState = 'idle';
let targetAIState = 'idle';
let transitionProgress = 0;
const transitionDuration = 300;
let speechAmplitude = 0;
let targetSpeechAmplitude = 0;
const amplitudeSmoothFactor = 0.2;

const circles = [];

class GlowingCircle {
    constructor(radius, offsetFactor, hue) {
        this.baseRadius = radius;
        this.offsetFactor = offsetFactor;
        this.hue = hue;
        this.phase = Math.random() * Math.PI * 2;
        this.speed = 0.008 + Math.random() * 0.015;
        this.detail = 25 + Math.floor(Math.random() * 10);
        this.offsets = Array.from({ length: this.detail }, () => (Math.random() - 0.5) * maxOffset);
        this.offsetSpeeds = Array.from({ length: this.detail }, () => (Math.random() - 0.5) * 0.08);
        this.currentRadius = radius;
        this.targetRadius = radius;
    }

    update(state, amplitude) {
        this.phase += this.speed;
        for (let i = 0; i < this.detail; i++) {
            this.offsets[i] += this.offsetSpeeds[i];
            if (this.offsets[i] > maxOffset || this.offsets[i] < -maxOffset) {
                this.offsetSpeeds[i] *= -1;
            }
        }

        let targetRadius = this.baseRadius;
        if (state === 'listening') {
            targetRadius = this.baseRadius + Math.sin(Date.now() * 0.002) * 7;
        } else if (state === 'thinking') {
            targetRadius = this.baseRadius + Math.sin(Date.now() * 0.005) * 9;
            this.speed *= (1 + Math.random() * 0.2 - 0.1);
        } else if (state === 'speaking') {
            targetRadius = this.baseRadius + amplitude * 8;
        } else if (state === 'displaying') {
            targetRadius = this.baseRadius + 120 + amplitude * 8;
        } else {
            targetRadius = this.baseRadius + amplitude * 4
        }
        this.targetRadius = targetRadius;
        this.currentRadius += (this.targetRadius - this.currentRadius) * 0.1;
    }

    draw() {
        ctx.beginPath();
        const points = [];
        for (let i = 0; i < this.detail; i++) {
            const angle = (i / this.detail) * Math.PI * 2;
            const distortedRadius = this.currentRadius + this.offsets[i] * this.offsetFactor;
            const x = centerX + Math.cos(angle) * distortedRadius;
            const y = centerY + Math.sin(angle) * distortedRadius;
            points.push({x, y});
        }

        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 0; i < this.detail; i++) {
            const nextPoint = points[(i + 1) % this.detail];
            const midPointX = (points[i].x + nextPoint.x) / 2;
            const midPointY = (points[i].y + nextPoint.y) / 2;
            ctx.quadraticCurveTo(points[i].x, points[i].y, midPointX, midPointY);
        }
        ctx.closePath();

        ctx.shadowColor = `hsla(${this.hue}, 80%, 75%, 0.7)`;
        ctx.shadowBlur = glowIntensity;
        ctx.strokeStyle = `hsla(${this.hue}, 100%, 80%, 0.9)`;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.shadowColor = `hsla(${this.hue}, 70%, 70%, 0.5)`;
        ctx.shadowBlur = glowIntensity * 2;
        ctx.stroke();

        ctx.shadowBlur = 0;
    }
}

function drawInnerContent(state, progress) {
    const innerRadiusBase = baseRadius * 0.8;
    const innerRadius = innerRadiusBase;

    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, innerRadius);
    gradient.addColorStop(0, `hsla(${baseHue}, 100%, 80%, 0.2)`);
    gradient.addColorStop(1, 'rgba(10,10,32,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
    ctx.fill();

    const baseColor = `hsla(${baseHue}, 100%, 80%, 0.9)`;
    const transparentColor = `hsla(${baseHue}, 100%, 80%, 0)`;
    const glowColor = `hsla(${baseHue}, 100%, 70%, 0.9)`;

    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 10;
    ctx.fillStyle = baseColor;

    // Управление видимостью и прозрачностью элементов InnerContent
    function setElementVisibility(elementId, visible) {
        const element = document.getElementById(elementId);
        if (element) {
            element.style.opacity = visible ? 1 : 0;
        }
    }

    // Скрываем все элементы перед отрисовкой
    ['listening-point', 'thinking-pulse', 'thinking-center', 'speaking-pill', 'searching-dot1', 'searching-dot2', 'idle-dot'].forEach(id => setElementVisibility(id, false));

    // Отрисовка элементов в зависимости от состояния
    if (state === 'listening') {
        const pointRadius = 10 + Math.sin(Date.now() * 0.01) * 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, pointRadius, 0, Math.PI * 2);
        ctx.fill();
    } else if (state === 'thinking') {
        const pulseRadius = innerRadius * 0.5 * (1 + Math.sin(Date.now() * 0.003));
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(centerX, centerY, 10, 0, Math.PI * 2);
        ctx.fill();
    } else if (state === 'speaking') {
        const pillWidth = 23;
        const pillHeight = 20 + speechAmplitude * 42;
        const cornerRadius = pillWidth / 3;

        ctx.beginPath();
        ctx.moveTo(centerX - pillWidth / 2 + cornerRadius, centerY - pillHeight / 2);
        ctx.lineTo(centerX + pillWidth / 2 - cornerRadius, centerY - pillHeight / 2);
        ctx.arcTo(centerX + pillWidth / 2, centerY - pillHeight / 2, centerX + pillWidth / 2, centerY - pillHeight / 2 + cornerRadius, cornerRadius);
        ctx.lineTo(centerX + pillWidth / 2, centerY + pillHeight / 2 - cornerRadius);
        ctx.arcTo(centerX + pillWidth / 2, centerY + pillHeight / 2, centerX + pillWidth / 2 - cornerRadius, centerY + pillHeight / 2, cornerRadius);
        ctx.lineTo(centerX - pillWidth / 2 + cornerRadius, centerY + pillHeight / 2);
        ctx.arcTo(centerX - pillWidth / 2, centerY + pillHeight / 2, centerX - pillWidth / 2, centerY + pillHeight / 2 - cornerRadius, cornerRadius);
        ctx.lineTo(centerX - pillWidth / 2, centerY - pillHeight / 2 + cornerRadius);
        ctx.arcTo(centerX - pillWidth / 2, centerY - pillHeight / 2, centerX - pillWidth / 2 + cornerRadius, centerY - pillHeight / 2, cornerRadius);
        ctx.fill();
    } else if (state === 'searching') {
        const angle1 = Date.now() * 0.001;
        const angle2 = Date.now() * 0.0015;
        const dist = innerRadius;
        ctx.beginPath();
        ctx.arc(centerX + Math.cos(angle1) * dist, centerY + Math.sin(angle1) * dist, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(centerX + Math.cos(angle2) * dist, centerY - Math.sin(angle2) * dist, 6, 0, Math.PI * 2);
        ctx.fill();
    } else if (state === 'idle') {
        ctx.beginPath();
        ctx.arc(centerX, centerY, 10, 0, Math.PI * 2);
        ctx.fill();
    } else if (state === 'displaying') {

    }
    ctx.shadowBlur = 0;
}

for (let i = 0; i < numCircles; i++) {
    const radius = baseRadius + i * 4;
    const offsetFactor = 1 + i * 0.08;
    const hue = baseHue + i * (hueVariation / numCircles);
    circles.push(new GlowingCircle(radius, offsetFactor, hue));
}

function animate() {
    requestAnimationFrame(animate);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const isTransitioning = aiState !== targetAIState;
    if (isTransitioning) {
        transitionProgress += 16; // Примерно 60 FPS
        if (transitionProgress >= transitionDuration) {
            transitionProgress = 0;
            aiState = targetAIState;
        }
    }

    const currentState = targetAIState; // Используем целевое состояние для отрисовки

    circles.forEach(circle => {
        circle.update(currentState, speechAmplitude);
        circle.draw();
    });

    if (currentState !== "displaying") {
        drawInnerContent(currentState, transitionProgress / transitionDuration);
    }

    // Плавное изменение амплитуды
    speechAmplitude += (targetSpeechAmplitude - speechAmplitude) * amplitudeSmoothFactor;

    // Плавное изменение интенсивности свечения
    glowIntensity += (targetGlowIntensity - glowIntensity) * glowSmoothFactor;
    const glowColor = `hsla(${baseHue}, 100%, 70%, 0.9)`;
    pupilGlow.style.boxShadow = `0px 0px 200px ${glowIntensity}px ${glowColor}`;

    // Обновление позиции и размера pupilGlow
    let pupilSize = 5;
    if (currentState === 'speaking') {
        pupilSize = 8 + speechAmplitude * 5;
    } else if (currentState === 'thinking') {
        pupilSize = 7;
    }
    pupilGlow.style.left = `${centerX - pupilSize / 2}px`;
    pupilGlow.style.top = `${centerY - pupilSize / 2}px`;
    pupilGlow.style.width = `${pupilSize}px`;
    pupilGlow.style.height = `${pupilSize}px`;
}

window.getAIState = () => {
    return targetAIState;
}

window.setAIState = (newState) => {
    targetAIState = newState;
    let youtubeId = null;
    console.log("Changing ai state to: " + newState)

    // Установка целевой интенсивности свечения
    if (newState === 'speaking') {
        targetGlowIntensity = 50;
        youtubePlayerContainer.style.opacity = 0;
    } else if (newState === 'thinking') {
        targetGlowIntensity = 45;
        youtubePlayerContainer.style.opacity = 0;
    } else if (newState === 'listening') {
        targetGlowIntensity = 40;
        youtubePlayerContainer.style.opacity = 0;
    } else if (newState === 'searching') {
        targetGlowIntensity = 42;
        youtubePlayerContainer.style.opacity = 0;
    } else if (newState === 'displaying' && youtubeId) {
        targetGlowIntensity = 42;
        youtubePlayerContainer.style.opacity = 1;
        youtubeIframe.src = `https://www.youtube.com/embed/${youtubeId}?autoplay=1&controls=0&showinfo=0&rel=0&loop=0&vq=hd720`;
    } else {
        targetGlowIntensity = 30;
        youtubePlayerContainer.style.opacity = 0;
        // Очищаем src iframe, чтобы остановить видео и предотвратить фоновое воспроизведение
        youtubeIframe.src = '';
    }

    console.log(targetAIState);

    transitionProgress = 0;
    if (newState === 'speaking') {

    } else {
        targetSpeechAmplitude = 0;
    }
}

window.setSpeakingAmplitude = (amplitude) => {
    targetSpeechAmplitude = amplitude
}

animate();

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    centerX = canvas.width / 2;
    centerY = canvas.height / 2;
});

// Функция для получения текущего значения --volume
function getVolumeValue() {
    const htmlElement = document.documentElement;
    const volume = getComputedStyle(htmlElement)
        .getPropertyValue('--volume')
        .trim();
    return parseInt(volume, 10); // Преобразуем в число
}

let volumeCheckTimeout = null;

// Настройка MutationObserver
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.attributeName === 'style') {
            const newVolume = getVolumeValue();
            console.log('Новое значение --volume:', newVolume);
            if (newVolume > 7) {
                window.setAIState("listening")
            }

            // Если значение меньше 6 и таймер не запущен
            if (newVolume < 6 && targetAIState === "listening") {
                if (!volumeCheckTimeout) {
                    volumeCheckTimeout = setTimeout(() => {
                        window.setAIState("thinking")
                        volumeCheckTimeout = null;
                    }, 700);
                }
            } else {
                if (volumeCheckTimeout) {
                    clearTimeout(volumeCheckTimeout);
                    volumeCheckTimeout = null;
                }
            }
        }
    });
});

// Начать наблюдение за элементом <html>
observer.observe(document.documentElement, {
    attributes: true, // Отслеживать изменения атрибутов
    attributeFilter: ['style'], // Только атрибут style
});
