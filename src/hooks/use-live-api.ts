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

function replaceEllipses(text: string) {
  return text.replace("...", "…");
}

async function localTts(text: string, setIsAiTalking: (talking: boolean) => void) { // Добавляем функцию для обновления isAiTalking
  if (!text.trim()) {
    setIsAiTalking(false); // TTS закончил говорить, сбрасываем флаг
    return;
  }

  setIsAiTalking(true); // TTS начал говорить, устанавливаем флаг

  const url = "http://localhost:8020/tts_to_audio/";
  const data = {
    "text": replaceEllipses(text),
    "speaker_wav": "C:\\Users\\maxim\\Downloads\\spark-sample.wav", // **Важно:** Проверьте путь!
    "language": "ru"
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      console.error(`HTTP error! status: ${response.status}`);
    }
    // Вы можете обработать ответ сервера здесь, если нужно
  } catch (error) {
    console.error("Could not send TTS request", error);
  } finally {
    setIsAiTalking(false); // TTS закончил попытку запроса, сбрасываем флаг (даже при ошибке)
  }
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
    const onContent = (message: any) => { // Изменено имя обработчика и события на "content"
      if (isModelTurn(message)) {
        console.log(message)
        const modelTurn = message.modelTurn;
        const textParts = modelTurn.parts.filter(part => part.text);
        if (textParts.length > 0) {
          const responseText = textParts.map(part => part.text).join("");
          lastMessage += responseText;
        }
      }
    };

    const onTurnComplete = () => { // Вызов TTS при завершении turn
      console.log("Turn complete, sending to TTS:", lastMessage);
      localTts(lastMessage, setIsAiTalking); // Вызываем функцию localTts и передаем функцию setIsAiTalking
      lastMessage = ""; // Сбрасываем lastMessage после отправки в TTS
    };

    // **Концептуальная реализация глушения микрофона:**
    const onRealtimeInput = (message: any) => { // Предполагаем, что есть обработчик для входящего realtimeInput
      if (isAiTalking) {
        console.log("Microphone Muted (AI Talking)");
        // В РЕАЛЬНОМ ПРИЛОЖЕНИИ ЗДЕСЬ НУЖНО ПРЕРВАТЬ ИЛИ ЗАГЛУШИТЬ ПОТОК МИКРОФОНА, ПРЕЖДЕ ЧЕМ ОТПРАВЛЯТЬ `realtimeInputMessage` КЛИЕНТУ.
        // НАПРИМЕР:
        // остановить запись с микрофона, или
        // не отправлять message.mediaChunks, если они есть, или
        // модифицировать message.mediaChunks, чтобы они были пустыми/тихими.
        return; // Прерываем дальнейшую обработку realtimeInput, если AI говорит
      }
      // ОБЫЧНАЯ ОБРАБОТКА realtimeInput, ЕСЛИ AI НЕ ГОВОРИТ:
      // console.log("Microphone Active (User Talking)", message);
      // client.sendRealtimeInput(message); // Пример отправки realtimeInput (нужно адаптировать под ваш код)
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
  }, [client, isAiTalking]); // Добавляем isAiTalking в зависимости useEffect, чтобы пере-рендерить при изменении

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
