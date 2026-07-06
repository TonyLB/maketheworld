//
// Shared Bedrock Runtime InvokeModel call: text in, Titan Embed v2 float vector out.
//

import {
    BedrockRuntimeClient,
    InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime'
import { SEMANTIC_EMBEDDING_V1_DIMENSIONS } from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'

export const BEDROCK_TITAN_EMBED_MODEL_ID = 'amazon.titan-embed-text-v2:0'

export type InvokeBedrockTitanEmbedSuccess = {
    success: true;
    embedding: number[];
    inputTextTokenCount?: number;
}

export type InvokeBedrockTitanEmbedFailure = {
    success: false;
    errorMessage: string;
}

export type InvokeBedrockTitanEmbedResult =
    | InvokeBedrockTitanEmbedSuccess
    | InvokeBedrockTitanEmbedFailure

export type InvokeBedrockTitanEmbedParams = {
    inputText: string;
    timeoutMs: number;
    client?: BedrockRuntimeClient;
}

let defaultClient: BedrockRuntimeClient | undefined

const getDefaultClient = (): BedrockRuntimeClient => {
    if (!defaultClient) {
        const region = process.env.AWS_REGION
        defaultClient = new BedrockRuntimeClient(region ? { region } : {})
    }
    return defaultClient
}

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function parseEmbeddingResponse(bodyText: string): InvokeBedrockTitanEmbedResult {
    let parsed: unknown
    try {
        parsed = JSON.parse(bodyText)
    } catch {
        return { success: false, errorMessage: 'Bedrock embed response is not valid JSON' }
    }

    if (!isRecord(parsed)) {
        return { success: false, errorMessage: 'Bedrock embed response is not a JSON object' }
    }

    const embedding = parsed.embedding
    if (!Array.isArray(embedding)) {
        return { success: false, errorMessage: 'Bedrock embed response missing embedding array' }
    }

    if (embedding.length !== SEMANTIC_EMBEDDING_V1_DIMENSIONS) {
        return {
            success: false,
            errorMessage: `Bedrock embed vector length mismatch: expected ${SEMANTIC_EMBEDDING_V1_DIMENSIONS}, got ${embedding.length}`,
        }
    }

    const badIndex = embedding.findIndex(
        (value) => typeof value !== 'number' || !Number.isFinite(value)
    )
    if (badIndex !== -1) {
        return {
            success: false,
            errorMessage: `Bedrock embed vector contains non-finite value at index ${badIndex}`,
        }
    }

    const tokenCount = parsed.inputTextTokenCount
    const success: InvokeBedrockTitanEmbedSuccess = {
        success: true,
        embedding: embedding as number[],
    }
    if (typeof tokenCount === 'number' && Number.isFinite(tokenCount)) {
        success.inputTextTokenCount = tokenCount
    }
    return success
}

/**
 * Invokes Bedrock Titan Text Embeddings v2 via InvokeModel.
 * Uses the Lambda region when constructing a default client.
 */
export async function invokeBedrockTitanEmbed(
    params: InvokeBedrockTitanEmbedParams
): Promise<InvokeBedrockTitanEmbedResult> {
    const { inputText, timeoutMs, client: clientOpt } = params

    if (inputText.length === 0) {
        return { success: false, errorMessage: 'inputText must be non-empty' }
    }

    const client = clientOpt ?? getDefaultClient()

    const abortController = new AbortController()
    const timeoutId = setTimeout(() => abortController.abort(), timeoutMs)

    const requestBody = JSON.stringify({
        inputText,
        dimensions: SEMANTIC_EMBEDDING_V1_DIMENSIONS,
        normalize: true,
    })

    try {
        const command = new InvokeModelCommand({
            modelId: BEDROCK_TITAN_EMBED_MODEL_ID,
            contentType: 'application/json',
            accept: 'application/json',
            body: requestBody,
        })
        const response = await client.send(command, { abortSignal: abortController.signal })
        clearTimeout(timeoutId)

        if (!response.body) {
            return { success: false, errorMessage: 'Bedrock embed response missing body' }
        }

        const bodyText = new TextDecoder().decode(response.body)
        return parseEmbeddingResponse(bodyText)
    } catch (err) {
        clearTimeout(timeoutId)
        const message = err instanceof Error ? err.message : String(err)
        const isTimeout = err instanceof Error && err.name === 'AbortError'
        return {
            success: false,
            errorMessage: isTimeout ? `Bedrock request timed out after ${timeoutMs}ms` : message,
        }
    }
}
