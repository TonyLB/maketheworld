import {
    SearchToken, SearchTokenComma, SearchTokenFirst, SearchTokenGroupClose, SearchTokenGroupOpen, SearchTokenNthChild, SearchTokenProperty, SearchTokenTag, SearchTokenWhitespace
} from "../baseClasses"
import SourceStream from "../../../parser/tokenizer/sourceStream"
import { checkSubTokenizers } from "./utils"
import whiteSpaceTokenizer from "./whiteSpace"
import tagTokenizer from "./tag"
import propertyTokenizer from "./property"
import { groupCloseTokenizer, groupOpenTokenizer } from "./group"
import nthChildTokenizer from "./nthChild"
import firstTokenizer from "./first"
import commaTokenizer from "./comma"
import { TokenizeException } from "../../../parser/tokenizer/baseClasses"

export const tokenizer = (sourceStream: SourceStream): SearchToken[] => {
    let returnValue: SearchToken[] = []

    while(!sourceStream.isEndOfSource) {
        const checkSubTokens = checkSubTokenizers<SearchTokenComma | SearchTokenFirst | SearchTokenGroupClose | SearchTokenGroupOpen | SearchTokenNthChild | SearchTokenProperty | SearchTokenTag | SearchTokenWhitespace>({
            sourceStream,
            subTokenizers: [whiteSpaceTokenizer, tagTokenizer, propertyTokenizer, groupOpenTokenizer, groupCloseTokenizer, nthChildTokenizer, firstTokenizer, commaTokenizer],
            callback: (token) => {
                if (token.type !== 'Whitespace') {
                    returnValue.push(token)
                }
            }
        })
        if (!checkSubTokens) {
            throw new TokenizeException(`Unexpected token: "${ sourceStream.source.slice(sourceStream.position, sourceStream.position) }"`, sourceStream.position, sourceStream.position)
        }
    }
    return returnValue
}

export default tokenizer
