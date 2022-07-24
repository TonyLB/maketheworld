import {
    Tokenizer,
    TokenBooleanProperty
} from "./baseClasses"

export const booleanPropertyTokenizer: Tokenizer<TokenBooleanProperty> = (sourceStream) => {
    const firstChar = sourceStream.lookAhead(1)
    if (firstChar.match(/[A-Za-z\!]/)) {
        const startIdx = sourceStream.position
        let returnValue = firstChar === '!' ? sourceStream.consume(1) : ''
        let key = ''
        while(sourceStream.lookAhead(1).match(/[A-Za-z]/)) {
            key = key + sourceStream.consume(1)
        }
        returnValue = returnValue + key
        return {
            type: 'BooleanValue',
            source: returnValue,
            value: firstChar !== '!',
            key,
            startIdx,
            endIdx: sourceStream.position - 1
        }
    }
    else {
        return undefined
    }
}

export default booleanPropertyTokenizer
