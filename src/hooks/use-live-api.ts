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

async function localTts(text: string, setIsAiTalking: (talking: boolean) => void): Promise<void> { // Возвращаем Promise<void>
  return new Promise(async (resolve) => { // Оборачиваем в Promise
    try {
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
              isPlaying = true;
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

      audio.addEventListener('timeupdate', () => {
        const remainingTime = audio.duration - audio.currentTime;
        if (remainingTime <= 2.4 && !actionExecuted) {
          // Выполняем действие за секунду до завершения
          URL.revokeObjectURL(audio.src);
          setIsAiTalking(false);
          actionExecuted = true;
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

  const ttsQueue = useRef<string[]>([]); // Очередь для текстов TTS
  const isTtsProcessing = useRef(false); // Флаг, указывающий, выполняется ли TTS в данный момент

  const processTtsQueue = useCallback(async () => {
    if (isTtsProcessing.current) {
      return; // Если TTS уже выполняется, ничего не делаем
    }

    if (ttsQueue.current.length === 0) {
      return; // Если очередь пуста, выходим
    }

    isTtsProcessing.current = true; // Устанавливаем флаг обработки

    const textToSynthesize = ttsQueue.current.shift(); // Берем первый текст из очереди
    if (textToSynthesize) {
      await localTts(textToSynthesize, setIsAiTalking); // Выполняем TTS
    }

    isTtsProcessing.current = false; // Сбрасываем флаг обработки после завершения TTS

    // Проверяем, есть ли еще элементы в очереди, и если есть, запускаем следующую итерацию
    if (ttsQueue.current.length > 0) {
      processTtsQueue(); // Рекурсивный вызов для обработки следующего элемента
    }
  }, [setIsAiTalking]);


  // register audio for streaming server -> speakers
  useEffect(() => {
    if (!audioStreamerRef.current) {
      audioContext({ id: "audio-out" }).then((audioCtx: AudioContext) => {
        audioStreamerRef.current = new AudioStreamer(audioCtx);
        audioStreamerRef.current
            .addWorklet<any>("vumeter-out", VolMeterWorket, (ev: any) => {
              setVolume(ev.data.volume);
            })
            .then(() => {
              // Successfully added worklet
            });
      });
    }
  }, [audioStreamerRef]);

  useEffect(() => {
    const onClose = () => {
      setConnected(false);
    };

    const stopAudioStreamer = () => audioStreamerRef.current?.stop();

    const onAudio = (data: ArrayBuffer) =>
        audioStreamerRef.current?.addPCM16(new Uint8Array(data));

    let lastMessage ="";

    // **Новый код: Обработка текстовых ответов от Gemini, изменено имя события на "content"**
    const onContent = async (message: any) => { // Изменено имя обработчика и события на "content"
      if (isModelTurn(message)) {
        console.log(message)
        const modelTurn = message.modelTurn;
        const textParts = modelTurn.parts.filter(part => part.text);
        if (textParts.length > 0) {
          const responseText = textParts.map(part => part.text).join("");
          ttsQueue.current.push(responseText); // Добавляем текст в очередь
          processTtsQueue(); // Запускаем обработку очереди
          lastMessage += responseText;
        }
      }
    };

    // В обработчике onTurnComplete добавляем void для Promise
    const onTurnComplete = () => {
      console.log("Turn complete, sending to TTS:", lastMessage);
      // FIX 4: Добавляем void для асинхронной операции
      lastMessage = "";
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
