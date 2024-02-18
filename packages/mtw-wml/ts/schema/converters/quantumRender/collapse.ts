import { PrintMapResult, PrintMode } from "../baseClasses";
import { lineLengthAfterIndent } from "../printUtils";

//
// collapse accepts a list of PrintMapResult records and chooses the simplest one of them that can
// render, given the options provided
//
export const collapse = (outputs: PrintMapResult[], { indent = 0 }: { indent?: number } = {}): PrintMapResult => {
    const lineLengthAllowed = lineLengthAfterIndent(indent)
    const maxLengthFactory = (output: string) => (
        output
            .split('\n')
            .map((outputLine) => (outputLine.length))
            .reduce((previous, value) => Math.max(previous, value), 0)
    )
    const returnValue = outputs.reduce<{ output?: PrintMapResult; currentLength: number }>((previous, output) => {
        const { currentLength } = previous
        if (currentLength <= lineLengthAllowed) {
            return previous
        }
        const maxLength = maxLengthFactory(output.output)
        if (maxLength < currentLength) {
            return { output, currentLength: maxLength }
        }
        return previous
    }, { currentLength: Infinity }).output
    if (!returnValue) {
        throw new Error('No output calculated in collapse')
    }
    return returnValue
}

export default collapse
