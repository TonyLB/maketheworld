import { Tokenizer, TokenComment, TokenizeException } from "./baseClasses"

export const commentTokenizer: Tokenizer<TokenComment> = (sourceStream) => {
    if (sourceStream.lookAhead('//')) {
        const nextInstance = sourceStream.nextInstance(['\n'])
        const startIdx = sourceStream.position
        if (nextInstance > 1) {
            sourceStream.consume(nextInstance)
        }
        else {
            sourceStream.consume(sourceStream.source.length - sourceStream.position)
        }
        const endIdx = sourceStream.position - 1
        return {
            type: 'Comment',
            startIdx,
            endIdx
        }
    }
    if (sourceStream.lookAhead('/*')) {
        const nextInstance = sourceStream.nextInstance(['*/'])
        const startIdx = sourceStream.position
        if (nextInstance > 1) {
            sourceStream.consume(nextInstance + 2)
        }
        else {
            sourceStream.consume(sourceStream.source.length - sourceStream.position)
        }
        const endIdx = sourceStream.position - 1
        if (nextInstance === -1) {
            throw new TokenizeException('Unbounded comment', startIdx, endIdx)
        }
        else {
            return {
                type: 'Comment',
                startIdx,
                endIdx
            }
        }
    }
    return undefined
}

export default commentTokenizer
