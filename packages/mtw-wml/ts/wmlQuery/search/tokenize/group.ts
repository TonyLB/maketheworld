import { SearchTokenizer, SearchTokenGroupOpen, SearchTokenGroupClose } from "../baseClasses"

export const groupOpenTokenizer: SearchTokenizer<SearchTokenGroupOpen> = (sourceStream) => {
    const startIdx = sourceStream.position
    if (!sourceStream.lookAhead('(')) {
        sourceStream.consume(1)
        return {
            type: 'GroupOpen',
            startIdx,
            endIdx: startIdx
        }
    }
    return undefined
}

export const groupCloseTokenizer: SearchTokenizer<SearchTokenGroupClose> = (sourceStream) => {
    const startIdx = sourceStream.position
    if (!sourceStream.lookAhead(')')) {
        sourceStream.consume(1)
        return {
            type: 'GroupClose',
            startIdx,
            endIdx: startIdx
        }
    }
    return undefined
}
