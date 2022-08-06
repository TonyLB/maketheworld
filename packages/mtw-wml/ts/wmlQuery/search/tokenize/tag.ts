import { SearchTokenizer, SearchTokenTag, SearchTokenTagLegal } from "../baseClasses"
import { TokenizeException } from "../../../parser/tokenizer/baseClasses"

const legalTags: SearchTokenTagLegal[] = [
    'Asset',
    'Character',
    'Condition',
    'Description',
    'Exit',
    'Feature',
    'Layer',
    'Map',
    'Name',
    'OneCoolThing',
    'Outfit',
    'Pronouns',
    'Room',
    'Story'
]

const isLegalTagString = (value: string): value is SearchTokenTagLegal => ((legalTags as string[]).includes(value))

export const tagTokenizer: SearchTokenizer<SearchTokenTag> = (sourceStream) => {
    const startIdx = sourceStream.position
    if (!sourceStream.lookAhead(1).match(/[A-Za-z]/)) {
        return undefined
    }
    while (sourceStream.lookAhead(1).match(/[A-Za-z]/)) {
        sourceStream.consume(1)
    }
    const tagCheck: string = sourceStream.source.slice(startIdx, sourceStream.position)
    if (isLegalTagString(tagCheck)) {
        return {
            type: 'Tag',
            startIdx,
            endIdx: sourceStream.position - 1,
            tag: tagCheck
        }    
    }
    else {
        throw new TokenizeException(`Unexpected token: "${sourceStream.source.slice(startIdx, sourceStream.position)}"`, startIdx, sourceStream.position)
    }
}

export default tagTokenizer
