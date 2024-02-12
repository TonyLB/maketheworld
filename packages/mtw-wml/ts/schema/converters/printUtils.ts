import { PrintMapResult, PrintMode } from "./baseClasses"

export const indentSpacing = (indent: number): string => {
    return '    '.repeat(indent >= 0 ? indent : 0)
}

export const lineLengthAfterIndent = (indent: number): number => (Math.max(40, 80 - indent * 4))

//
// SECTION: Utility functions for dealing with multiple-render listings, and organizing them by nesting level
//

export const isNaivePrint = (output: string) => (output.split('\n').length <= 1)
export const isNestedPrint = (output: string) => (output.split('\n').length > 1 && Boolean(output.split('\n').find((outputLine) => (outputLine.match(/(?!<:\\)<[^/].*(?!<:\\)>/)))))
export const isPropertyNestedPrint = (output: string) => (output.split('\n').length > 1 && !isNestedPrint(output))

//
// maxIndicesByNestingLevel takes a list of many renders (each with multiple possible levels of nesting and styles of render)
// and lists the maximum indices in each PrintMode
//
export const maxIndicesByNestingLevel = (outputs: PrintMapResult[][]): Record<PrintMode, number> => (
    outputs.reduce<Record<PrintMode, number>>((previous, itemOutputs) => {
        const naiveOutputs = itemOutputs.filter(({ printMode }) => (printMode === PrintMode.naive))
        const nestedOutputs = itemOutputs.filter(({ printMode }) => (printMode === PrintMode.nested))
        const propertyNestedOutputs = itemOutputs.filter(({ printMode }) => (printMode === PrintMode.propertyNested))
        return {
            [PrintMode.naive]: Math.max(previous[PrintMode.naive], naiveOutputs.length),
            [PrintMode.nested]: Math.max(previous[PrintMode.nested], nestedOutputs.length),
            [PrintMode.propertyNested]: Math.max(previous[PrintMode.propertyNested], propertyNestedOutputs.length),
        }
    }, { [PrintMode.naive]: 0, [PrintMode.nested]: 0, [PrintMode.propertyNested]: 0 })
)

//
// minIndicesByNestingLevel does the same as maxIndicesByNestingLevel, but returns the minimum
//
export const minIndicesByNestingLevel = (outputs: string[][]): Record<PrintMode, number> => (
    outputs.reduce<Record<PrintMode, number>>((previous, itemOutputs) => {
        const naiveOutputs = itemOutputs.filter(isNaivePrint)
        const nestedOutputs = itemOutputs.filter(isNestedPrint)
        const propertyNestedOutputs = itemOutputs.filter(isPropertyNestedPrint)
        return {
            [PrintMode.naive]: Math.min(previous[PrintMode.naive], naiveOutputs.length),
            [PrintMode.nested]: Math.min(previous[PrintMode.nested], nestedOutputs.length),
            [PrintMode.propertyNested]: Math.min(previous[PrintMode.propertyNested], propertyNestedOutputs.length),
        }
    }, { [PrintMode.naive]: Infinity, [PrintMode.nested]: Infinity, [PrintMode.propertyNested]: Infinity })
)

//
// provisionalPrintFactory generates a list of results selected from the outputs, according to the nestingLevel and index provided.
// So it will search up (for instance) the second Naive interpretation of each among many renders, and return them.
//
export const provisionalPrintFactory = ({ outputs, nestingLevel, indexInLevel }: { outputs: PrintMapResult[][]; nestingLevel: PrintMode; indexInLevel: number }): PrintMapResult[] => {
    const lookup = ({ itemOutputs, nestingLevel, indexInLevel }: { itemOutputs: PrintMapResult[]; nestingLevel: PrintMode; indexInLevel: number }) => {
        if (itemOutputs.length === 0) {
            throw new Error('Empty itemOutput list in provisionalPrintFactory')
        }
        const naiveOutputs = itemOutputs.filter(({ printMode }) => (printMode === PrintMode.naive))
        const nestedOutputs = itemOutputs.filter(({ printMode }) => (printMode === PrintMode.nested))
        const propertyNestedOutputs = itemOutputs.filter(({ printMode }) => (printMode === PrintMode.propertyNested))
        if (nestingLevel === PrintMode.naive) {
            if (naiveOutputs.length === 0) {
                return lookup({ itemOutputs, nestingLevel: PrintMode.nested, indexInLevel: 0 })
            }
            return naiveOutputs[Math.min(indexInLevel, naiveOutputs.length - 1)]
        }
        else if (nestingLevel === PrintMode.nested) {
            if (nestedOutputs.length === 0) {
                //
                // If there are no nested outputs, default up to naive first, with propertyNested as a fallback
                //
                if (naiveOutputs.length) {
                    return lookup({ itemOutputs, nestingLevel: PrintMode.naive, indexInLevel: naiveOutputs.length - 1 })
                }
                else {
                    return lookup({ itemOutputs, nestingLevel: PrintMode.propertyNested, indexInLevel: 0 })
                }
            }
            return nestedOutputs[Math.min(indexInLevel, nestedOutputs.length - 1)]
        }
        else {
            if (propertyNestedOutputs.length === 0) {
                return lookup({ itemOutputs, nestingLevel: PrintMode.nested, indexInLevel: nestedOutputs.length - 1 })
            }
            return propertyNestedOutputs[Math.min(indexInLevel, propertyNestedOutputs.length - 1)]
        }
    }
    return outputs.map((itemOutputs) => (lookup({ itemOutputs, nestingLevel, indexInLevel })))
}

//
// combineResults takes lists of results and returns up to three categories, without filtering on whether the
//    renders will fit within line-length limits:
//    - A naive view, if every incoming value set includes naive contents
//    - A nested view, if every incoming value set includes naive or nested
//    - A propertyNested view, if that option is set
//
export const combineResults = (options: { multipleInCategory?: boolean; propertyNestedAllowed?: boolean; separateLines?: boolean } = {}) => (...args: PrintMapResult[][]): PrintMapResult[] => {
    return args.reduce<PrintMapResult[]>((previous, output) => {
        const previousNaive = previous.filter(({ printMode }) => (printMode === PrintMode.naive))
        const previousNested = previous.find(({ printMode }) => (printMode === PrintMode.nested))
            ? previous.filter(({ printMode }) => (printMode === PrintMode.nested))
            : previousNaive
        const currentNaive = output.filter(({ printMode }) => (printMode === PrintMode.naive))
        const currentNested = output.find(({ printMode }) => (printMode === PrintMode.nested))
            ? output.filter(({ printMode }) => (printMode === PrintMode.nested))
            : currentNaive
        const combineLevel = (listA: PrintMapResult[], listB: PrintMapResult[], transform: (inputA: PrintMapResult, inputB: PrintMapResult) => PrintMapResult): PrintMapResult[] => (
            Math.min(listA.length, listB.length) === 0
                ? []
                : Array.apply(null, Array(Math.min(listA.length, listB.length)))
                    .map((_, index) => (transform(listA[Math.min(index, listA.length - 1)], listB[Math.min(index, listB.length - 1)])))
        )
        const combineTransform = (printMode: PrintMode, separator: string) => (inputA: PrintMapResult, inputB: PrintMapResult) => (
            inputA.output
                ? { printMode, output: [inputA.output, inputB.output].join(separator)}
                : inputB
        )
        const returnValues = [
            // Combine naive, if available
            ...(options.separateLines
                ? combineLevel(previousNaive, currentNaive, combineTransform(PrintMode.nested, '\n'))
                : combineLevel(previousNaive, currentNaive, combineTransform(PrintMode.naive, ''))
            ),
            ...combineLevel(previousNested, currentNested, combineTransform(PrintMode.nested, options.separateLines ? '\n' : ''))
        ]
        if (options.multipleInCategory) {
            return returnValues
        }
        else {
            return [
                ...(returnValues.filter(({ printMode }) => (printMode === PrintMode.naive)).slice(0, 1)),
                ...(returnValues.filter(({ printMode }) => (printMode === PrintMode.nested)).slice(0, 1)),
                ...(options.propertyNestedAllowed ? returnValues.filter(({ printMode }) => (printMode === PrintMode.propertyNested)).slice(0, 1) : [])
            ]
        }
    }, [{ printMode: PrintMode.naive, output: '' }, { printMode: PrintMode.nested, output: '' }])
}
