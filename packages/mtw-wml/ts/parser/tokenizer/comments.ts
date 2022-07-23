import { Tokenizer, TokenComment } from "./baseClasses"

export const commentTokenizer: Tokenizer<TokenComment> = (sourceStream) => {
    if (sourceStream.lookAhead('//')) {
        const nextInstance = sourceStream.nextInstance(['\n'])
        const startIdx = sourceStream.position
        const returnValue = sourceStream.consume((nextInstance > 1) ? nextInstance : undefined)
        const endIdx = sourceStream.position - 1
        return {
            type: 'Comment',
            source: returnValue,
            startIdx,
            endIdx
        }
    }
    if (sourceStream.lookAhead('/*')) {
        const nextInstance = sourceStream.nextInstance(['*/'])
        const startIdx = sourceStream.position
        const returnValue = sourceStream.consume((nextInstance > 1) ? nextInstance + 2 : undefined)
        const endIdx = sourceStream.position - 1
        if (nextInstance === -1) {
            return {
                type: 'Error',
                message: 'Unbounded comment',
                source: returnValue,
                startIdx,
                endIdx
            }
        }
        else {
            return {
                type: 'Comment',
                source: returnValue,
                startIdx,
                endIdx
            }
        }
    }
    return undefined
}

export default commentTokenizer
