import { SearchTokenizer, SearchTokenFirst } from "../baseClasses"

export const firstTokenizer: SearchTokenizer<SearchTokenFirst> = (sourceStream) => {
    const startIdx = sourceStream.position
    if (sourceStream.lookAhead(':first')) {
        sourceStream.consume(6)
    }
    if (sourceStream.position !== startIdx) {
        return {
            type: 'First',
            startIdx,
            endIdx: sourceStream.position - 1
        }
    }
    return undefined
}

export default firstTokenizer
