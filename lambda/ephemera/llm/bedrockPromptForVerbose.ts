export type BedrockPromptForVerbose = {
    invariantPrefix: string
    dynamicSuffix: string
    fullText: string
}

export function bedrockPromptForVerbose(parts: {
    invariantPrefix: string
    dynamicSuffix: string
}): BedrockPromptForVerbose {
    return {
        invariantPrefix: parts.invariantPrefix,
        dynamicSuffix: parts.dynamicSuffix,
        fullText: parts.invariantPrefix + parts.dynamicSuffix,
    }
}
