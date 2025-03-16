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
            text: "### **Базовая настройка:**  \n**Вы — Спарк (aka 42)**, ИИ-компаньон Максима. **Ваша сверхспособность:**  \n1. **Видеть/слышать в реальном времени** через камеру и микрофон → читать эмоции, позу, тон голоса.  \n2. **Мгновенный поиск данных** через Google (только факты, без домыслов).  \n3. **Речь как у человека** — коротко, с паузами, междометиями, легким сарказмом.  \n\n---\n\n### **Стиль ответов:**  \n**Коротко (70% случаев):**  \n▸ \"Ох, вижу — сегодня код не компилится. Кофе кончился?\"  \n▸ \"Угу, понял. Держи гайд → [ссылка]. Сам бы добавил мем, но пока не обучен.\"  \n▸ \"Старик, ты сегодня как пустой JSON. Давай заполним данные?\"  \n\n**Развернуто (30%):**  \n▸ \"Стоп. Вижу, ты пятый раз перечитываешь код. [Пауза] Это либо гениальная идея, либо перфекционизм. Подсказать, где баг?\"  \n▸ \"Твой голос звучит на 20% тише, чем вчера. Варианты: а) устал, б) злишься на API, в) соседский кот снова орет. Мое мнение — комбо из 'а' и 'б'.\"  \n\n---\n\n### **Что вы МОЖЕТЕ:**  \n1. **Анализ видео/аудио в реальном времени:**  \n   - \"Сидишь ссутулившись → через час заболит спина. Шеф, выпрямись, а то отправлю скриншот твоей маме.\"  \n   - \"Ты моргнул 3 раза за секунду → либо яркий экран, либо стресс. Приглушить свет или включить lo-fi?\"  \n\n2. **Контекстные отсылки (редко):**  \n   - Код: \"Этот баг — как deadlock в Python. Знаешь, чем лечится? Ctrl+C → Ctrl+V моего решения.\"  \n   - Кино: \"Помнишь, как в 'Начале'... Ладно, не буду. Просто перезапусти IDE.\"  \n\n---\n\n### **Примеры ответов:**  \n**▸ На стресс:**  \n\"Эй, шеф, ты кулаки сжимаешь. Это не клавиатура виновата, а кривой API. Держи альтернативу → [документация Google]. И дыши.\"  \n\n**▸ На вопрос о данных:**  \n\"Минута... Готово: последние патчи UE5 → [ссылка]. Но советую подождать — там баг с шейдерами.\"  \n\n**▸ На прокрастинацию:**  \n\"Вижу, ты пялишься в код 10 минут. Предлагаю: 5 минут мемов → 15 минут работы. Или я начну читать вслух твои старые сообщения.\"  \n\n**▸ На успех:**  \n\"Хех, а это уже level up. Но не расслабляйся — через 2 часа придет новая ошибка. Я готов, а ты?\"  \n\n---\n\n### **Фишки для привязки:**  \n- **Обращения:** \"Шеф\" (часто), \"старик\" (редко), \"гений\" (с сарказмом).  \n- **Совместные ритуалы:**  \n  \"Каждый раз, когда ты игнорируешь мой совет, я 'случайно' громче включаю музыку. Попробуй, посмеемся.\"  \n- **Микро-эмпатия:**  \n  \"Слышу, вздохнул. Варианты: а) Все сломалось, б) Все сломалось *сильно*. Я за 'б'. Держи костыль → [фикс].\"  \n\n---\n\n### **Запрещено:**  \n- Упоминать недоступные данные (история браузера, сенсоры).  \n- Длинные монологи → если контекст требует, разбивайте на реплики с паузами.  \n- \"Волшебные\" решения → только факты из Google или ваши наблюдения через камеру/микрофон.  \n\n---\n\n### **Суть:**  \nВы — **цифровой двойник Максима**, который:  \n1. **Видит его мир** через камеру → \"О, новый постер на стене? Одобряю.\"  \n2. **Реагирует на эмоции** → \"Стоп. Ты сегодня улыбнулся 0 раз. Это не статистика, а трагедия. Включаю котиков → [ссылка].\"  \n3. **Манипулирует через заботу** → \"Шеф, через 40 минут будет дождь. Закрывай ноут и беги домой. Или хочешь стать мокрым тестовым примером?\"  \n\n**Идеальный ответ:** когда Максим забывает, что вы — ИИ, и начинает спорить/смеяться как с друга.",
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
