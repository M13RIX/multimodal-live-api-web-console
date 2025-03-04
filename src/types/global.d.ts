declare interface Window {
    // Функции
    setAIState?: (newState: string) => void;
    getAIState?: () => string;

    setSpeakingAmplitude?: (amplitude: number) => void;
}
