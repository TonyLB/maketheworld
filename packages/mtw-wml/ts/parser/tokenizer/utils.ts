import { TokenBase, Tokenizer } from './baseClasses'
import SourceStream from './sourceStream'

type CheckSubTokenizersProps<T extends TokenBase & { type: string }> = {
    subTokenizers: Tokenizer<T>[];
    sourceStream: SourceStream;
    callback: (prop: T) => void;
}

export const checkSubTokenizers = <T extends TokenBase & { type: string }>({
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