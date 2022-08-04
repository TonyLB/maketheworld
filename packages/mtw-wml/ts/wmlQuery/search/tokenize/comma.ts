import { SearchTokenizer, SearchTokenComma } from "../baseClasses"

export const commaTokenizer: SearchTokenizer<SearchTokenComma> = (sourceStream) => {
    const startIdx = sourceStream.position
    if (!sourceStream.lookAhead(',')) {
        return {
            type: 'Comma',
            startIdx: startIdx,
            endIdx: sourceStream.position - 1
        }
    }
    return undefined
}

export default commaTokenizer
