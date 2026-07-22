import { NextResponse } from "next/server";
import OpenAI from "openai";
import type { ChatCompletionCreateParamsStreaming } from "openai/resources/chat/completions";
import { getSessionUser } from "@/lib/auth";
import { getSkills } from "@/lib/skills";
import { getTarotQuizSettings } from "@/lib/tarot-quiz-store";
import {
  assembleTarotQuizSystemPrompt,
  buildTarotQuizUserPrompt,
  type TarotQuizPromptInput,
} from "@/lib/tarot-quiz-template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const nvidiaBaseUrl = "https://integrate.api.nvidia.com/v1";
// 模型和思考深度在页面「模型设置」里配置（存数据库），这里只是兜底默认值。
const DEFAULT_MODEL = "deepseek-ai/deepseek-v4-pro";
const DEFAULT_REASONING_EFFORT = "high";

type NvidiaChatCompletionParams = ChatCompletionCreateParamsStreaming & {
  chat_template_kwargs?: {
    thinking?: boolean;
    reasoning_effort?: "max" | "high" | "medium" | "low";
  };
};

type GenerateRequestBody = {
  input?: TarotQuizPromptInput;
  /** Skill id to generate with; the episode skill pulls in the whole library. */
  target?: string;
};

let nvidiaOpenAiClient: { apiKey: string; client: OpenAI } | null = null;

function getNvidiaOpenAiClient(apiKey: string) {
  if (!nvidiaOpenAiClient || nvidiaOpenAiClient.apiKey !== apiKey) {
    nvidiaOpenAiClient = {
      apiKey,
      client: new OpenAI({
        apiKey,
        baseURL: nvidiaBaseUrl,
      }),
    };
  }

  return nvidiaOpenAiClient.client;
}

function apiError(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : "Unknown AI generation error";

  console.error("[api/ai/tarot-quiz]", message);

  return NextResponse.json(
    {
      error: "AI generation failed",
      detail: message,
    },
    { status },
  );
}

// Streams the completion back as plain text so the client can render tokens
// as they arrive instead of waiting minutes for the full response.
export async function POST(request: Request) {
  try {
    const session = await getSessionUser();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = process.env.NVIDIA_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "NVIDIA_API_KEY is not configured",
          detail: "请先配置 NVIDIA_API_KEY，或直接复制提示词到任意 AI 使用。",
        },
        { status: 503 },
      );
    }

    const body = (await request.json()) as GenerateRequestBody;
    const input = body.input ?? {};
    const [skills, settings] = await Promise.all([
      getSkills(),
      getTarotQuizSettings().catch(() => null),
    ]);
    const aiModel = settings?.model?.trim() || DEFAULT_MODEL;
    const reasoningEffort = settings?.reasoningEffort || DEFAULT_REASONING_EFFORT;

    if (skills.length === 0) {
      return NextResponse.json(
        {
          error: "No skills found",
          detail: "skills/ 目录为空，请把栏目技能（SKILL.md）放进项目的 skills/ 目录。",
        },
        { status: 503 },
      );
    }

    const target =
      skills.find((skill) => skill.id === body.target) ??
      skills.find((skill) => skill.id === "tarot-quiz-episode") ??
      skills[0];
    const included = target.id === "tarot-quiz-episode" ? skills : [target];

    const completionRequest: NvidiaChatCompletionParams = {
      model: aiModel,
      stream: true,
      messages: [
        {
          role: "system",
          content: assembleTarotQuizSystemPrompt(included),
        },
        {
          role: "user",
          content: buildTarotQuizUserPrompt(input, target),
        },
      ],
      temperature: 1,
      top_p: 0.95,
      max_tokens: 16384,
      chat_template_kwargs: {
        thinking: true,
        reasoning_effort: reasoningEffort,
      },
    };

    // NDJSON event stream. Two long silent phases must stay visible to the
    // client: (1) NVIDIA queues the request before sending headers, so the
    // Response is returned immediately and the upstream connection happens
    // inside the stream; (2) DeepSeek with thinking enabled emits minutes of
    // reasoning_content before the first content token, so reasoning is
    // forwarded too.
    const encoder = new TextEncoder();
    const send = (controller: ReadableStreamDefaultController<Uint8Array>, event: object) => {
      controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
    };
    let upstreamAbort: (() => void) | null = null;
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          send(controller, { type: "status", message: "已连接，正在排队等待模型…" });

          const completion = await getNvidiaOpenAiClient(apiKey).chat.completions.create(
            completionRequest,
            { signal: request.signal },
          );
          upstreamAbort = () => completion.controller.abort();
          send(controller, { type: "status", message: "模型已响应，开始输出…" });

          for await (const chunk of completion) {
            const delta = chunk.choices[0]?.delta as
              | { content?: string | null; reasoning_content?: string | null; reasoning?: string | null }
              | undefined;

            const reasoningDelta = delta?.reasoning_content ?? delta?.reasoning;
            if (reasoningDelta) {
              send(controller, { type: "reasoning", text: reasoningDelta });
            }
            if (delta?.content) {
              send(controller, { type: "content", text: delta.content });
            }
          }
          send(controller, { type: "done" });
          controller.close();
        } catch (error) {
          try {
            send(controller, {
              type: "error",
              message: error instanceof Error ? error.message : "生成中断，请重试。",
            });
            controller.close();
          } catch {
            controller.error(error);
          }
        }
      },
      cancel() {
        upstreamAbort?.();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
