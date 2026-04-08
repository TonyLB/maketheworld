import { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import type { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import type {
    EphemeraCacheMarkState,
    EphemeraCacheRenderedContent,
    EphemeraCacheDynamoItem
} from '../dataSource/renderCache/baseClasses'
import type { RenderTree } from '@tonylb/mtw-base/ts/renderTree'
import { buildRoomDescriptionPrompt } from './buildRoomDescriptionPrompt'
import { invokeBedrockRoomDescription } from './invokeBedrockRoomDescription'

const toRenderTree = (s: string | null | undefined): RenderTree => (s == null || s === '' ? [] : [s])

export type GenerateRoomDescriptionInput = {
    roomId: EphemeraRoomId;
    markState: EphemeraCacheMarkState;
    perspective: { assetStack: AssetUUID[] };
    generationContext: StandardForm | null;
    cachedExamples?: EphemeraCacheDynamoItem[];
}

export type GenerateRoomDescriptionSuccess = {
    success: true;
    renderedContent: EphemeraCacheRenderedContent;
}

export type GenerateRoomDescriptionFailure = {
    success: false;
    errorCode: 'NO_EXACT_MATCH' | 'GENERATION_FAILED';
    errorMessage: string;
}

export type GenerateRoomDescriptionResult =
    | GenerateRoomDescriptionSuccess
    | GenerateRoomDescriptionFailure

type LLMOutput = {
    displayName?: string;
    summary?: string;
    description: string;
}

/** Strip markdown code fences and extract a JSON object from the model response. */
function extractJsonBody(raw: string): string {
    let s = raw.trim()
    // Remove optional ```json or ``` opening fence and closing ```
    const openFence = /^```(?:json)?\s*\n?/i
    const closeFence = /\n?```\s*$/
    s = s.replace(openFence, '').replace(closeFence, '').trim()
    // If there is still leading/trailing text, try to take the first { ... } object
    const firstBrace = s.indexOf('{')
    if (firstBrace === -1) return s
    const lastBrace = s.lastIndexOf('}')
    if (lastBrace === -1 || lastBrace <= firstBrace) return s
    return s.slice(firstBrace, lastBrace + 1)
}

function parseAndValidateLLMOutput(body: string): LLMOutput | null {
    const toParse = extractJsonBody(body)
    let parsed: unknown
    try {
        parsed = JSON.parse(toParse)
    } catch {
        return null
    }
    if (!parsed || typeof parsed !== 'object') return null
    const obj = parsed as Record<string, unknown>
    const description = obj.description
    if (typeof description !== 'string') return null
    const displayName = obj.displayName
    const summary = obj.summary
    if (displayName !== undefined && typeof displayName !== 'string') return null
    if (summary !== undefined && typeof summary !== 'string') return null
    return {
        displayName: typeof displayName === 'string' ? displayName : undefined,
        summary: typeof summary === 'string' ? summary : undefined,
        description
    }
}

/**
 * Generates room description via Bedrock Nova 2 Lite when no exact cache match exists.
 * Uses generation context (Room, Lens, Marks, Guidance) and cached examples to build
 * a prompt, then parses and validates the model JSON output.
 */
export const generateRoomDescription = async (
    input: GenerateRoomDescriptionInput
): Promise<GenerateRoomDescriptionResult> => {
    const { roomId, generationContext, markState, cachedExamples = [] } = input

    if (!generationContext) {
        return {
            success: false,
            errorCode: 'NO_EXACT_MATCH',
            errorMessage: 'No exact match for proposed state'
        }
    }

    const prompt = buildRoomDescriptionPrompt({
        roomId,
        generationContext,
        markState,
        cachedExamples
    })

    const invokeResult = await invokeBedrockRoomDescription(prompt)
    if (!invokeResult.success) {
        return {
            success: false,
            errorCode: 'GENERATION_FAILED',
            errorMessage: invokeResult.errorMessage
        }
    }

    const parsed = parseAndValidateLLMOutput(invokeResult.body)
    if (!parsed) {
        return {
            success: false,
            errorCode: 'GENERATION_FAILED',
            errorMessage: 'Model response was not valid JSON with required fields'
        }
    }

    const renderedContent: EphemeraCacheRenderedContent = {
        description: toRenderTree(parsed.description),
        ...(parsed.displayName !== undefined && { displayName: toRenderTree(parsed.displayName) }),
        ...(parsed.summary !== undefined && { summary: toRenderTree(parsed.summary) })
    }

    return {
        success: true,
        renderedContent
    }
}
