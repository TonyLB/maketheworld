import type { ThinkingResultEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'

import { ThinkingResultsPublic } from './baseClasses'

export type PublicSelectors = {
    getThinkingResult: (state: ThinkingResultsPublic) => ThinkingResultEvent | undefined
    getThinkingResultError: (state: ThinkingResultsPublic) => string | undefined
}

export const publicSelectors: PublicSelectors = {
    getThinkingResult: (state) => state.result,
    getThinkingResultError: (state) => state.fetchError
}
