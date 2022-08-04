import { SearchTokenizer } from '../baseClasses'
import SourceStream from '../../../parser/tokenizer/sourceStream'

type CheckSubTokenizersProps<T extends { type: string }> = {
    subTokenizers: SearchTokenizer<T>[];
    sourceStream: SourceStream;
    callback: (prop: T) => void;
}

export const checkSubTokenizers = <T extends { type: string }>({
    sourceStream,
    subTokenizers,
    callback
}: CheckSubTokenizersProps<T>): boolean => {
    return subTokenizers.reduce((previous, subTokenizer) => {
        if (!previous) {
            const checkSubTokens = subTokenizer(sourceStream)
            if (checkSubTokens) {
                callback(checkSubTokens)
                return true
            }
        }
        return previous
    }, false)
}