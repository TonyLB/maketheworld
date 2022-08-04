import { SearchTokenizer, SearchTokenComma } from "../baseClasses"

export const commaTokenizer: SearchTokenizer<SearchTokenComma> = (sourceStream) => {
    const startIdx = sourceStream.position
    if (!sourceStream.lookAhead(',')) {
        sourceStream.consume(1)
        return {
            type: 'Comma',
            startIdx,
            endIdx: startIdx,
        }
    }
    return undefined
}

export default commaTokenizer
