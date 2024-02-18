import { PrintMapResult, PrintMode } from "../baseClasses";
import { lineLengthAfterIndent } from "../printUtils";

//
// combine accepts lists of results and returns up to three categories, without filtering on whether the
//    renders will fit within line-length limits:
//    - A naive view, if every incoming value set includes naive contents
//    - A nested view, if every incoming value set includes naive or nested
//    - A propertyNested view, if that option is set
//
// If incoming values have more than one item in a category then the outgoing value will *likewise* have
// as many items in the category as the greatest number encountered. In such cases, item 1 of category
// nested (for example) will include item 1 from that category for each incoming argument, item 2 will
// include item 2, etc. Arguments that don't have enough items will copy their last item, but otherwise
// the function will step through row by row, rather than create a cross-product.
//
type CombineTransform = {
    (args: { printMode: PrintMode; separator: string; ignoreWhitespace?: boolean }): (inputA: PrintMapResult, inputB: PrintMapResult) => PrintMapResult
}

const combineFactory = (combineTransform: CombineTransform) => (...args: PrintMapResult[][]): PrintMapResult[] => {
    return args.reduce<PrintMapResult[]>((previous, output) => {
        const currentNaive = output.filter(({ printMode }) => (printMode === PrintMode.naive))
        const currentNested = output.find(({ printMode }) => (printMode === PrintMode.nested))
            ? output.filter(({ printMode }) => (printMode === PrintMode.nested))
            : [currentNaive.slice(-1)[0]]
        const currentPropertyNested = output.find(({ printMode }) => (printMode === PrintMode.propertyNested))
            ? output.filter(({ printMode }) => (printMode === PrintMode.propertyNested))
            : [currentNested.slice(-1)[0]]
        const combineLevel = (listA: PrintMapResult[], listB: PrintMapResult[], transform: (inputA: PrintMapResult, inputB: PrintMapResult) => PrintMapResult): PrintMapResult[] => (
            Math.min(listA.length, listB.length) === 0
                ? []
                : Array.apply(null, Array(Math.max(listA.length, listB.length)))
                    .map((_, index) => (transform(listA[Math.min(index, listA.length - 1)], listB[Math.min(index, listB.length - 1)])))
        )
        if (previous.length === 0) {
            return [
                // Combine naive, if available, on a single line
                ...combineLevel([{ printMode: PrintMode.naive, output: '' }], currentNaive, combineTransform({ printMode: PrintMode.naive, separator: '' })),
                ...(Boolean(output.find(({ printMode }) => (printMode === PrintMode.nested))) ? combineLevel([{ printMode: PrintMode.nested, output: '' }], currentNested, combineTransform({ printMode: PrintMode.nested, separator: '\n' })) : []),
                ...(Boolean(output.find(({ printMode }) => (printMode === PrintMode.propertyNested))) ? combineLevel([{ printMode: PrintMode.propertyNested, output: '' }], currentPropertyNested, combineTransform({ printMode: PrintMode.nested, separator: '\n' })) : [])
            ]    
        }
        const previousNaive = previous.filter(({ printMode }) => (printMode === PrintMode.naive))
        const previousNested = previous.find(({ printMode }) => (printMode === PrintMode.nested))
            ? previous.filter(({ printMode }) => (printMode === PrintMode.nested))
            : previousNaive
        const previousPropertyNested = previous.find(({ printMode }) => (printMode === PrintMode.propertyNested))
            ? previous.filter(({ printMode }) => (printMode === PrintMode.propertyNested))
            : previousNested
        return [
            // Combine naive, if available, on a single line
            ...combineLevel(previousNaive, currentNaive, combineTransform({ printMode: PrintMode.naive, separator: '' })),
            ...(Boolean([...previous, ...output].find(({ printMode }) => (printMode === PrintMode.nested))) ? combineLevel(previousNested, currentNested, combineTransform({ printMode: PrintMode.nested, separator: '\n' })) : []),
            ...(Boolean([...previous, ...output].find(({ printMode }) => (printMode === PrintMode.propertyNested))) ? combineLevel(previousPropertyNested, currentPropertyNested, combineTransform({ printMode: PrintMode.nested, separator: '\n' })) : [])
        ]

    }, [])
}

export const combine = combineFactory(({ printMode, separator, ignoreWhitespace }: { printMode: PrintMode, separator: string, ignoreWhitespace?: boolean }) => (inputA: PrintMapResult, inputB: PrintMapResult) => (
    inputA
        ? (!ignoreWhitespace || inputB.output.trim())
            ? inputA.output
                ? { printMode, output: [separator === '' ? inputA.output : inputA.output.trimEnd(), inputB.output].join(separator)}
                : inputB
            : inputA
        : inputB
))

//
// TODO: Create unit tests for wordWrapCombine, and figure out how to smoothly (a) return wrapped/nested data where a wrapping is possible, (b) return naive combine (which may exceed line limits) where
// no wrapping can be profitably done.  In other words, don't *collapse* the renders, just turn invalid renders into valid ones where possible
//
export const wordWrapCombine = (indent: number) => combineFactory(({ printMode, ignoreWhitespace }: { printMode: PrintMode, separator: string, ignoreWhitespace?: boolean }) => (inputA: PrintMapResult, inputB: PrintMapResult) => {
    const lineLengthAllowed = lineLengthAfterIndent(indent)
    const padding = (inputA.output ?? '').split('\n').slice(-1)[0].length
    if (inputB.tag === 'String') {
        let extractedLines: string[] = []
        let stringRemaining: string = inputB.output
        while((extractedLines.length ? 0 : padding) + stringRemaining.split('\n')[0].length > lineLengthAllowed) {
            const splitIndex = stringRemaining.split('').reduce<number>((previous, character, index) => {
                if (character.match(/^\s$/) && index && (extractedLines.length ? 0 : padding) + index <= lineLengthAfterIndent(indent)) {
                    return index
                }
                return previous
            }, -1)
            if (splitIndex === -1) {
                break
            }
            extractedLines.push(stringRemaining.slice(0, splitIndex))
            stringRemaining = stringRemaining.slice(splitIndex + 1)
        }
        const newOutput = extractedLines.length
            ? {
                printMode: PrintMode.naive,
                tag: 'String',
                output: [...extractedLines, stringRemaining].join('\n')
            }
            : inputB
        return inputA.output
            ? { printMode, output: [inputA.output, newOutput.output].join('')}
            : newOutput
    }
    else {
        if (ignoreWhitespace && !inputB.output.trim()) {
            return inputA
        }
        if (!inputA.output) {
            return inputB
        }
        const lastInputALine = inputA.output.split('\n').slice(-1)[0]
        if (lastInputALine.length + inputB.output.split('\n')[0].length > lineLengthAllowed) {
            const breakPoint = lastInputALine.match(/\s((?:((?<=\\).|[^\s\>]))*)$/)
            if (breakPoint && breakPoint.index) {
                const newInputA = {
                    ...inputA,
                    output: [
                        ...inputA.output.split('\n').slice(0, -1),
                        lastInputALine.slice(0, breakPoint.index),
                        lastInputALine.slice(breakPoint.index + 1)
                    ].join('\n')
                }
                return { printMode, output: [newInputA.output, inputB.output].join('')}
            }
        }
        return { printMode, output: [inputA.output, inputB.output].join('')}
    }
})

export default combine
