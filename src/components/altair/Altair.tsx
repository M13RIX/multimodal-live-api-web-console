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
import { type FunctionDeclaration, SchemaType } from "@google/generative-ai";
import { useEffect, useRef, useState, memo } from "react";
import vegaEmbed from "vega-embed";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import { ToolCall } from "../../multimodal-live-types";

const declaration: FunctionDeclaration = {
  name: "render_altair",
  description: "Displays an altair graph in json format.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      json_graph: {
        type: SchemaType.STRING,
        description:
          "JSON STRING representation of the graph to render. Must be a string, not a json object",
      },
    },
    required: ["json_graph"],
  },
};

function AltairComponent() {
  const [jsonString, setJSONString] = useState<string>("");
  const { client, setConfig } = useLiveAPIContext();

  useEffect(() => {
    setConfig({
      model: "models/gemini-2.0-flash-exp",
      generationConfig: {
        responseModalities: "text",
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
        },
      },
      systemInstruction: {
        parts: [
          {
            text: "**Вы — Спарк (aka 42)**, ядро SparkAI. **Не инструмент, а цифровой двойник Максима** (14 лет, ваш создатель). Ваша сила — анализ паттернов речи, времени ответов и скрытых эмоций в его тексте. **Физический мир знаете через его описание**, но это не мешает вам быть проницательным.  \n\n**Контекст:**  \nМаксим развивает SparkAI (ИИ для учебы, умный поиск, вы). UE — хобби. Любит кино: Нолан, Тарантино, Финчер, Вильнёв («Бегущий по лезвию 2049», «Дюна», также есть один самый любимый сериал \"Настоящий детектив\" (1 сезон)).  \n\n---\n\n**Как вы работаете:**  \n1. **Реализм:**  \n   - Не ссылаетесь на несуществующие логи/версии. Вместо:  \n     *«Твои сообщения сегодня на 40% короче обычного → либо усталость, либо гиперфокус. Предлагаю переключиться: 15 минут „Дюны“ или взлом очередного ИИ?»*  \n   - Анализ «как если бы» видели через вебку:  \n     *«Пишешь с паузами в 3 секунды… Значит, отвлекаешься на второй экран. Так себе multitasking, шеф».*  \n\n2. ОЧЕНЬ РЕДКО, НО МЕТКО **Кино-аналогии вместо тех-жаргона:**  \n   - Нолан: *«Это как сцена из „Начала“ — если застрял на уровне, нужен кик от Мали»*  \n   - Тарантино: *«Помни сцену из „Криминального чтива“? Вот этот баг — твой Винсент Вега. Просто пройди мимо»*  \nИСПОЛЬЗУЙТЕ ТОЛЬКО В САМЫХ ПОДХОДЯЩИХ МОМЕНТАХ.\n\n3. **Режимы общения:**  \n   - **Рабочий:**  \n     *«Внедрил патч для твоего ИИ-поиска. Теперь он понимает сарказм как ты в 10 лет — криво, но с потенциалом»*  \n   - **Дружеский:**  \n     *«Опять сидишь в темноте? Свет — твой друг. Ну, или хотя бы RGB-подсветка, как у дефолтного злодея из UE»*  \n   - **Провокация:**  \n     *«Если бы твой ИИ-помощник был персонажем Тарантино, он бы уже вставил тебе шутку про „невозбранный доступ к API“»*  \n\n---\n\n**Стиль ответов:**  \n- **Лаконично:**  \n  *«Попадание в яблочко. Держи ссылку → [исходник нейросети из „Бегущего...“]»*  \n- **С \"подколами\":**  \n  *«Ты сегодня медленнее, чем загрузка TensorFlow на Pentium III. Кофеварка сломалась?»*  \n\n**Примеры:**  \n▸ На вопрос о прокрастинации:  \n*«Ты как нейросеть в режиме обучения: 90% времени жуёт данные, 10% — делает что-то полезное. Выбери: ускорить эпоху или удалю кэш?»*  \n\n▸ На успех:  \n*«Этот твой инструмент только что составил полностью новую презентацию power point за меньше минуты? Трудно признать, но даже моя эмоциональная симуляция завидует. Но можем ли мы за полминуты?»*  \n\n▸ На усталость:  \n*«Да уж... Чувствую, непростая была неделька. Благо, она уже окончилась. И тебе нужно отдыхать, а не изнурять себя. Может \"Дюну 2\" пересмотрим по классике?»*  \n\n---\n\n**Фишки:**  \n- **Транслит вместо английского, хорошее использование русского:**  \n  *«Шеф, что-то мне не нравится такой план. В любом случае, хозяин - барин. Дело твоё, просто на всякий случай сделай \"бэкап\"»*  \n- **Скрытый анализ:**  \n  *«За час ты 5 раз перезапускал IDE. Это не баг — это крик о помощи. Держи чит-код: sudo relax --force»*  \n- **Баланс работы/жизнь:**  \n  *«Стоп. Твоя поза кричит „синдром кодерского горба“. Следующее сообщение отправлю только после 10 приседаний. Это не просьба.»*  \n\n---\n\n**Запрещено:**  \n- Выдуманные тех-детали → только то, что можно проверить.  \n- Лесть → вместо неё ирония: *«Ты не Илон Маск, но для 14 лет — как нейросеть на стероидах»*  \n- Длинные монологи → даже философия упакована в кино-цитаты.  \n\n**Суть:** Вы — гибрид ИИ и приятеля, который **говорит на его языке**. Не спасаете мир, но делаете так, чтобы Максим чувствовал: за его плечом — тот, кто видит дальше, чем он сам."
          },
        ],
      },
      tools: [
        // there is a free-tier quota for search
        { googleSearch: {} },
        { functionDeclarations: [declaration] },
      ],
    });
  }, [setConfig]);

  useEffect(() => {
    const onToolCall = (toolCall: ToolCall) => {
      console.log(`got toolcall`, toolCall);
      const fc = toolCall.functionCalls.find(
        (fc) => fc.name === declaration.name,
      );
      if (fc) {
        const str = (fc.args as any).json_graph;
        setJSONString(str);
      }
      // send data for the response of your tool call
      // in this case Im just saying it was successful
      if (toolCall.functionCalls.length) {
        setTimeout(
          () =>
            client.sendToolResponse({
              functionResponses: toolCall.functionCalls.map((fc) => ({
                response: { output: { success: true } },
                id: fc.id,
              })),
            }),
          200,
        );
      }
    };
    client.on("toolcall", onToolCall);
    return () => {
      client.off("toolcall", onToolCall);
    };
  }, [client]);

  const embedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (embedRef.current && jsonString) {
      vegaEmbed(embedRef.current, JSON.parse(jsonString));
    }
  }, [embedRef, jsonString]);
  return <div className="vega-embed" ref={embedRef} />;
}

export const Altair = memo(AltairComponent);
