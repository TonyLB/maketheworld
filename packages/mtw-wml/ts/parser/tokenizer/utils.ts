import { TokenBase, Tokenizer, TokenError, isTokenError } from './baseClasses'
import SourceStream from './sourceStream'

type CheckSubTokenizerProps<T extends TokenBase & { type: string }> = {
    currentBuffer: string;
    startIdx: number;
    subTokenizer: Tokenizer<T>,
    sourceStream: SourceStream
}

type CheckSubTokenizerReturn = {
    returnBuffer?: string;
    error?: TokenError;
}

export const checkSubTokenizer = <T extends TokenBase & { type: string }>({
    currentBuffer, startIdx, subTokenizer, sourceStream
}: CheckSubTokenizerProps<T>): CheckSubTokenizerReturn => {
    const checkSubTokens = subTokenizer(sourceStream)
    if (checkSubTokens) {
        if (isTokenError(checkSubTokens)) {
            return {
                error: {
                    type: 'Error',
                    source: currentBuffer + checkSubTokens.source,
                    startIdx,
                    endIdx: checkSubTokens.endIdx,
                    message: checkSubTokens.message
                }
            }
        }
        else {
            return {
                returnBuffer: currentBuffer + checkSubTokens.source
            }
        }
    }
    else {
        return {}
    }
}
