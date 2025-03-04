import React, { useLayoutEffect } from 'react';

const HtmlVisualizer = () => {
    useLayoutEffect(() => {
        // Ваш оригинальный скрипт
        const script = `
      // Ваш оригинальный JavaScript код
      const canvas = document.getElementById('visualizerCanvas');
      // ... весь ваш код без изменений ...
      
      window.setAIState = setAIState; // Экспортируем функцию наружу
    `;

        // Вставляем скрипт в DOM
        const scriptElement = document.createElement('script');
        scriptElement.innerHTML = script;
        document.body.appendChild(scriptElement);

        return () => {
            document.body.removeChild(scriptElement);
            window.setAIState = null;
        };
    }, []);

    return (
        <>
            <canvas
                id="visualizerCanvas"
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    zIndex: -1,
                    width: '100vw',
                    height: '100vh'
                }}
            />

            <div
                id="pupil-glow"
                style={{
                    position: 'fixed',
                    background: 'rgba(255, 255, 255, 0.9)',
                    borderRadius: '50%',
                    pointerEvents: 'none'
                }}
            />

            <div
                id="youtube-player-container"
                style={{
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    opacity: 0,
                    transition: 'opacity 0.3s ease',
                    zIndex: 999
                }}
            >
                <iframe
                    id="youtube-iframe"
                    title="YouTube player"
                    allowFullScreen
                    style={{
                        width: '640px',
                        height: '360px',
                        border: 'none'
                    }}
                />
            </div>
        </>
    );
};

export default HtmlVisualizer;
