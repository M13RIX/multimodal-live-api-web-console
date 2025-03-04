/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MultimodalLiveAPIClientConnection,
  MultimodalLiveClient,
} from "../lib/multimodal-live-client";
import { LiveConfig } from "../multimodal-live-types";
import { AudioStreamer } from "../lib/audio-streamer";
import { audioContext } from "../lib/utils";
import VolMeterWorket from "../lib/worklets/vol-meter";
import { isModelTurn } from "../multimodal-live-types"; // Импортируем Type Guards

export type UseLiveAPIResults = {
  client: MultimodalLiveClient;
  setConfig: (config: LiveConfig) => void;
  config: LiveConfig;
  connected: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  volume: number;
  isAiTalking: boolean; // Добавляем состояние isAiTalking
};

async function localTts(text: string, setIsAiTalking: (talking: boolean) => void, islast: boolean = false): Promise<void> { // Возвращаем Promise<void>
  return new Promise(async (resolve) => { // Оборачиваем в Promise
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      let animationFrameId: number;

      // Настройка анализатора
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      // Функция для анализа амплитуды
      const analyzeAmplitude = () => {
        analyser.getByteTimeDomainData(dataArray);
        let sum = 0;

        for (let i = 0; i < bufferLength; i++) {
          const value = (dataArray[i] - 128) / 128;
          sum += value * value;
        }

        const amplitude = sum / 3;

        // Отправка события с амплитудой
        if (window.setSpeakingAmplitude) window.setSpeakingAmplitude(amplitude)

        animationFrameId = requestAnimationFrame(analyzeAmplitude);
      };

      setIsAiTalking(true);

      const response = await fetch('https://spark-api.up.railway.app/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      if (!response.body) throw new Error('No response body');
      const reader = response.body.getReader();

      const mediaSource = new MediaSource();
      const audio = new Audio(URL.createObjectURL(mediaSource));
      let sourceBuffer: SourceBuffer;
      let queue: Uint8Array[] = [];
      let isPlaying = false;

      // Подключение анализатора к аудио
      const source = audioContext.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(audioContext.destination);

      mediaSource.addEventListener('sourceopen', async () => {
        try {
          sourceBuffer = mediaSource.addSourceBuffer('audio/webm; codecs="opus"');
          sourceBuffer.mode = 'sequence';

          // 1. Сначала собираем весь буфер
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            queue.push(value);
          }

          // 2. Затем последовательно воспроизводим
          const playChunk = async () => {
            if (queue.length === 0) {
              if (mediaSource.readyState === 'open') {
                mediaSource.endOfStream();
              }
              return;
            }

            await new Promise<void>(resolveChunk => {
              sourceBuffer.appendBuffer(queue.shift()!.buffer);
              sourceBuffer.addEventListener('updateend', () => resolveChunk(), { once: true });
            });

            if (!isPlaying) {
              await audio.play();
              if (window.setAIState) window.setAIState("speaking");
              isPlaying = true;
              audioContext.resume();
              analyzeAmplitude();
            }

            playChunk();
          };

          playChunk();

        } catch (err) {
          console.error('Stream error:', err);
          mediaSource.endOfStream();
        }
      });

      let actionExecuted = false;
      let minimumTime = 2.4;
      if (islast) {
        minimumTime = 0.2;
        console.log("LAST")
      };

      audio.addEventListener('timeupdate', () => {
        const remainingTime = audio.duration - audio.currentTime;
        if (remainingTime <= minimumTime && !actionExecuted) {
          // Выполняем действие за секунду до завершения
          URL.revokeObjectURL(audio.src);
          actionExecuted = true;
          setIsAiTalking(false);
          console.log("finish audio")
          resolve(); // Разрешаем Promise после завершения TTS
        }
      });

    } catch (error) {
      console.error('TTS Error:', error);
      setIsAiTalking(false);
      resolve(); // Разрешаем Promise в случае ошибки, чтобы очередь не зависла
    }
  });
}


export function useLiveAPI({
                             url,
                             apiKey,
                           }: MultimodalLiveAPIClientConnection): UseLiveAPIResults {
  const client = useMemo(
      () => new MultimodalLiveClient({ url, apiKey }),
      [url, apiKey],
  );
  const audioStreamerRef = useRef<AudioStreamer | null>(null);

  const [connected, setConnected] = useState(false);
  const [config, setConfig] = useState<LiveConfig>({
    model: "models/gemini-2.0-flash-exp",
  });
  const [volume, setVolume] = useState(0);
  const [isAiTalking, setIsAiTalking] = useState(false); // Инициализируем состояние isAiTalking

  const ttsQueue = useRef<string[]>([]);
  const isTtsProcessing = useRef(false);
  const incompleteWordBuffer = useRef(''); // Буфер для незавершенных слов

  const findLastSeparatorIndex = (text: string): number => {
    const separators = [' ', '.', '!', '?', ',', ';', ':', '\n', '\t'];
    let lastIndex = -1;
    for (const sep of separators) {
      const idx = text.lastIndexOf(sep);
      if (idx > lastIndex) lastIndex = idx;
    }
    return lastIndex;
  };

  const processTtsQueue = useCallback(async () => {
    if (isTtsProcessing.current || ttsQueue.current.length === 0) return;
    isTtsProcessing.current = true;

    let isLast = false;
    const textToSynthesize = ttsQueue.current.shift();

    if (/[?!.\n]$/.test(<string>textToSynthesize)) {
        isLast = true;
    }
    if (textToSynthesize) {
      await localTts(textToSynthesize, setIsAiTalking, isLast);
    }

    isTtsProcessing.current = false;
    if (ttsQueue.current.length > 0) processTtsQueue();
  }, [setIsAiTalking]);


  // register audio for streaming server -> speakers
  useEffect(() => {
    if (!audioStreamerRef.current) {
      audioContext({ id: "audio-out" }).then((audioCtx: AudioContext) => {
        audioStreamerRef.current = new AudioStreamer(audioCtx);
        if (audioStreamerRef.current instanceof AudioStreamer) {
          audioStreamerRef.current
              .addWorklet<any>("vumeter-out", VolMeterWorket, (ev: any) => {
                setVolume(ev.data.volume);
              })
              .then(() => {
                // Successfully added worklet
              });
        }
      });
    }
  }, [audioStreamerRef]);

  useEffect(() => {
    const onClose = () => {
      setConnected(false);
    };

    const stopAudioStreamer = () => audioStreamerRef.current?.stop();

    const onAudio = (data: ArrayBuffer) => {
        audioStreamerRef.current?.addPCM16(new Uint8Array(data));
        if (window.setAIState) {
          window.setAIState("listening");
        }
        console.log("listening")
    }

    let lastMessage ="";

    // **Новый код: Обработка текстовых ответов от Gemini, изменено имя события на "content"**
    const onContent = async (message: any) => {
      if (isModelTurn(message)) {
        const modelTurn = message.modelTurn;
        const textParts = modelTurn.parts.filter(part => part.text);
        if (textParts.length > 0) {
          const responseText = textParts.map(part => part.text).join("");
          const fullText = incompleteWordBuffer.current + responseText;
          const lastSeparatorIndex = findLastSeparatorIndex(fullText);

          if (lastSeparatorIndex >= 0) {
            const toSpeak = fullText.slice(0, lastSeparatorIndex + 1);
            incompleteWordBuffer.current = fullText.slice(lastSeparatorIndex + 1);
            if (toSpeak) {
              ttsQueue.current.push(toSpeak);
              console.log("TO SPEAK \"" + toSpeak + "\"")
             processTtsQueue();
            }
          } else {
            incompleteWordBuffer.current = fullText;
          }
        }
      }
    };

    // В обработчике onTurnComplete добавляем void для Promise
    const onTurnComplete = () => {
      if (incompleteWordBuffer.current) {
        ttsQueue.current.push(incompleteWordBuffer.current);
        incompleteWordBuffer.current = '';
        processTtsQueue();
      }
    };

    client
        .on("close", onClose)
        .on("interrupted", stopAudioStreamer)
        .on("audio", onAudio)
        .on("content", onContent) // Используем событие "content"
        .on("turncomplete", onTurnComplete)
    // .on("realtimeInput", onRealtimeInput) // **ВАЖНО:** Раскомментируйте и реализуйте обработку realtimeInput в вашем коде, если необходимо
    ;

    return () => {
      client
          .off("close", onClose)
          .off("interrupted", stopAudioStreamer)
          .off("audio", onAudio)
          .off("content", onContent) // Убираем обработчик "content"
          .off("turncomplete", onTurnComplete)
      // .off("realtimeInput", onRealtimeInput) // **ВАЖНО:**  Удалите обработчик, если раскомментировали выше
      ;
    };
  }, [client, isAiTalking, processTtsQueue]); // Добавляем processTtsQueue в зависимости useEffect


  const connect = useCallback(async () => {
    console.log(config);
    if (!config) {
      throw new Error("config has not been set");
    }
    client.disconnect();
    await client.connect(config);
    setConnected(true);
  }, [client, setConnected, config]);

  const disconnect = useCallback(async () => {
    client.disconnect();
    setConnected(false);
  }, [setConnected, client]);

  return {
    client,
    config,
    setConfig,
    connected,
    connect,
    disconnect,
    volume,
    isAiTalking, // Возвращаем isAiTalking из хука
  };
}
