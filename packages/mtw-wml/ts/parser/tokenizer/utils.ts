import { TokenBase, Tokenizer, TokenError, isTokenError } from './baseClasses'
import SourceStream from './sourceStream'

type CheckSubTokenizersProps<T extends TokenBase & { type: string }> = {
    subTokenizers: Tokenizer<T>[];
    sourceStream: SourceStream;
    callback: (prop: T) => void | CheckSubTokenizersReturn;
}

type CheckSubTokenizersSuccessReturn = {
    success: true
}

type CheckSubTokenizersErrorReturn = {
    success: false;
    error: TokenError;
}

type CheckSubTokenizersReturn = CheckSubTokenizersSuccessReturn | CheckSubTokenizersErrorReturn | undefined

export const checkSubTokenizers = <T extends TokenBase & { type: string }>({
    sourceStream,
    subTokenizers,
    callback
}: CheckSubTokenizersProps<T>): CheckSubTokenizersReturn => {
    const startIdx = sourceStream.position
    return subTokenizers.reduce<CheckSubTokenizersReturn>((previous, subTokenizer) => {
        if (!previous) {
            const checkSubTokens = subTokenizer(sourceStream)
            if (checkSubTokens) {
                if (isTokenError(checkSubTokens)) {
                    return {
                        success: false,
                        error: {
                            type: 'Error',
                            source: sourceStream.source.slice(startIdx, checkSubTokens.endIdx),
                            startIdx,
                            endIdx: checkSubTokens.endIdx,
                            message: checkSubTokens.message
                        }
                    }
                }
                else {
                    return callback(checkSubTokens) || {
                        success: true
                    }
                }
            }
        }
        return previous
    }, undefined as CheckSubTokenizersReturn)
}