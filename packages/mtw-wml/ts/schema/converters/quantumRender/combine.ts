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

type CombineFactoryLevel = {
    naive: PrintMapResult[];
    nested: PrintMapResult[];
    propertyNested: PrintMapResult[];
}

const padArray = <T>(list: T[], neededLength: number): T[] => {
    if (list.length === 0) {
        throw new Error('Empty array in padArray')
    }
    if (list.length === neededLength) {
        return list
    }
    else if (list.length > neededLength) {
        throw new Error('list in padArray larger than neededLength')
    }
    else {
        return [
            ...list,
            ...(new Array(neededLength - list.length)).fill(list.slice(-1)[0])
        ]
    }
}

const padLevel = (level: CombineFactoryLevel, naive: number, nested: number, propertyNested: number): CombineFactoryLevel => {
    if (!(level.naive.length || level.nested.length || level.propertyNested.length)) {
        throw new Error('Empty level in padLevel')
    }
    const nestedList = level.nested.length
        ? level.nested
        : level.naive.length
            ? [level.naive.slice(-1)[0]]
            : [level.propertyNested[0]]
    const naiveList = level.naive.length
        ? level.naive
        : [nestedList[0]]
    const propertyNestedList = level.propertyNested.length
        ? level.propertyNested
        : [nestedList.slice(-1)[0]]
    return {
        naive: naive ? padArray(naiveList, naive) : [],
        nested: nested ? padArray(nestedList, nested) : [],
        propertyNested: propertyNested ? padArray(propertyNestedList, propertyNested) : []
    }
}

//
// combineLevels assumes that it is receiving a list of arguments that are all padded to the same length,
// and then reduces each row (item 0 in all lists, item 1 in all lists, etc.) together using transform
//
const combineLevels = (transform: (inputA: PrintMapResult, inputB: PrintMapResult) => PrintMapResult) => (...args: PrintMapResult[][]): PrintMapResult[] => {
    return args.reduce<PrintMapResult[]>((previous, list, index) => {
        if (index === 0) {
            return list.map((result) => (transform({ printMode: result.printMode, output: '' }, result)))
        }
        else {
            return list.map((result, index) => (transform(previous[index], result)))
        }
    }, [])
}

const combineFactoryDefaultAggregator = (combineTransform: CombineTransform, ...args: CombineFactoryLevel[]): PrintMapResult[] => {
    const allHaveNaive = !Boolean(args.find(({ naive }) => (naive.length === 0)))
    const allHaveNested = !Boolean(args.find(({ naive, nested }) => (naive.length === 0 && nested.length === 0)))
    const naiveMaxLevels = Math.max(...args.map(({ naive }) => (naive.length)))
    const nestedMaxLevels = Math.max(...args.map(({ nested }) => (nested.length)))
    const propertyNestedMaxLevels = Math.max(...args.map(({ propertyNested }) => (propertyNested.length)))
    const paddedLevels = args
        .map((level) => (padLevel(level, naiveMaxLevels, nestedMaxLevels, propertyNestedMaxLevels)))
        .map(({ naive, nested, propertyNested }) => ({
            naive: allHaveNaive ? naive : [],
            nested: allHaveNested ? nested : [],
            propertyNested
        }))
    return [
        ...combineLevels(combineTransform({ printMode: PrintMode.naive, separator: '' }))(...paddedLevels.map(({ naive }) => (naive))),
        ...combineLevels(combineTransform({ printMode: PrintMode.nested, separator: '\n' }))(...paddedLevels.map(({ nested }) => (nested))),
        ...combineLevels(combineTransform({ printMode: PrintMode.propertyNested, separator: '\n' }))(...paddedLevels.map(({ propertyNested }) => (propertyNested)))
    ]
}

const combineFactory = (
        combineTransform: CombineTransform,
        aggregator: (combineTransform: CombineTransform, ...args: CombineFactoryLevel[]) => PrintMapResult[] = combineFactoryDefaultAggregator
    ) => (...args: PrintMapResult[][]): PrintMapResult[] => {
    const rawLevels = args.map((arg) => (
        arg.reduce<CombineFactoryLevel>((previous, printResult) => {
            switch(printResult.printMode) {
                case PrintMode.naive:
                    return {
                        ...previous,
                        naive: [...previous.naive, printResult]
                    }
                case PrintMode.nested:
                    return {
                        ...previous,
                        nested: [...previous.nested, printResult]
                    }
                case PrintMode.propertyNested:
                    return {
                        ...previous,
                        propertyNested: [...previous.propertyNested, printResult]
                    }
            }
        }, { naive: [], nested: [], propertyNested: [] })
    ))
    return aggregator(combineTransform, ...rawLevels)
    // const padLevel = (list: PrintMapResult[], neededLength: number): PrintMapResult[] => {
    //     if (list.length === neededLength) {
    //         return list
    //     }
    //     else {
    //         return [
    //             ...list,
    //             ...(new Array(neededLength - list.length)).fill(list.slice(-1)[0])
    //         ]
    //     }
    // }
    // const allHaveNaive = !Boolean(rawLevels.find(({ naive }) => (naive.length === 0)))
    // const naiveMaxLevels = Math.max(...rawLevels.map(({ naive }) => (naive.length)))
    // const nestedMaxLevels = Math.max(...rawLevels.map(({ nested }) => (nested.length)))
    // const propertyNestedMaxLevels = Math.max(...rawLevels.map(({ propertyNested }) => (propertyNested.length)))
    // const paddedLevels: CombineFactoryLevel[] = rawLevels.map((level) => ({
    //     naive: allHaveNaive ? padLevel(level.naive, naiveMaxLevels) : [],
    //     nested: padLevel(level.nested.length ? level.nested : level.naive.slice[-1], nestedMaxLevels),
    //     propertyNested: padLevel(level.propertyNested.length ? level.propertyNested : level.nested.length ? level.nested : level.naive.slice[-1], propertyNestedMaxLevels)
    // }))
    // const combineLevel = (transform: (inputA: PrintMapResult, inputB: PrintMapResult) => PrintMapResult) => (...args: PrintMapResult[][]): PrintMapResult[] => {
    //     const maxLength = Math.max(...args.map((list) => (list.length)))
    //     const paddedLevels = args.map((list) => (padLevel(list, maxLength)))
    //     return paddedLevels.reduce<PrintMapResult[]>((previous, list, index) => {
    //         if (index === 0) {
    //             return list.map((result) => (transform({ printMode: result[0].printMode, output: '' }, result)))
    //         }
    //         else {
    //             return list.map((result, index) => (transform(previous[index], result)))
    //         }
    //     }, [])
    // }
    // return args.reduce<PrintMapResult[]>((previous, output) => {
    //     const currentNaive = output.filter(({ printMode }) => (printMode === PrintMode.naive))
    //     const currentNested = output.find(({ printMode }) => (printMode === PrintMode.nested))
    //         ? output.filter(({ printMode }) => (printMode === PrintMode.nested))
    //         : [currentNaive.slice(-1)[0]]
    //     const currentPropertyNested = output.find(({ printMode }) => (printMode === PrintMode.propertyNested))
    //         ? output.filter(({ printMode }) => (printMode === PrintMode.propertyNested))
    //         : [currentNested.slice(-1)[0]]
    //     const combineLevel = (listA: PrintMapResult[], listB: PrintMapResult[], transform: (inputA: PrintMapResult, inputB: PrintMapResult) => PrintMapResult): PrintMapResult[] => (
    //         Math.min(listA.length, listB.length) === 0
    //             ? []
    //             : Array.apply(null, Array(Math.max(listA.length, listB.length)))
    //                 .map((_, index) => (transform(listA[Math.min(index, listA.length - 1)], listB[Math.min(index, listB.length - 1)])))
    //     )
    //     if (previous.length === 0) {
    //         return [
    //             // Combine naive, if available, on a single line
    //             ...combineLevel([{ printMode: PrintMode.naive, output: '' }], currentNaive, combineTransform({ printMode: PrintMode.naive, separator: '' })),
    //             ...(Boolean(output.find(({ printMode }) => (printMode === PrintMode.nested))) ? combineLevel([{ printMode: PrintMode.nested, output: '' }], currentNested, combineTransform({ printMode: PrintMode.nested, separator: '\n' })) : []),
    //             ...(Boolean(output.find(({ printMode }) => (printMode === PrintMode.propertyNested))) ? combineLevel([{ printMode: PrintMode.propertyNested, output: '' }], currentPropertyNested, combineTransform({ printMode: PrintMode.nested, separator: '\n' })) : [])
    //         ]    
    //     }
    //     const previousNaive = previous.filter(({ printMode }) => (printMode === PrintMode.naive))
    //     const previousNested = previous.find(({ printMode }) => (printMode === PrintMode.nested))
    //         ? previous.filter(({ printMode }) => (printMode === PrintMode.nested))
    //         : previousNaive
    //     const previousPropertyNested = previous.find(({ printMode }) => (printMode === PrintMode.propertyNested))
    //         ? previous.filter(({ printMode }) => (printMode === PrintMode.propertyNested))
    //         : previousNested
    //     return [
    //         // Combine naive, if available, on a single line
    //         ...combineLevel(previousNaive, currentNaive, combineTransform({ printMode: PrintMode.naive, separator: '' })),
    //         ...(Boolean([...previous, ...output].find(({ printMode }) => (printMode === PrintMode.nested))) ? combineLevel(previousNested, currentNested, combineTransform({ printMode: PrintMode.nested, separator: '\n' })) : []),
    //         ...(Boolean([...previous, ...output].find(({ printMode }) => (printMode === PrintMode.propertyNested))) ? combineLevel(previousPropertyNested, currentPropertyNested, combineTransform({ printMode: PrintMode.nested, separator: '\n' })) : [])
    //     ]

    // }, [])
}

const simpleCombineTransform = ({ printMode, separator, ignoreWhitespace }: { printMode: PrintMode, separator: string, ignoreWhitespace?: boolean }) => (inputA: PrintMapResult, inputB: PrintMapResult) => (
    inputA
        ? (!ignoreWhitespace || inputB.output.trim())
            ? inputA.output
                ? { printMode, output: [separator === '' ? inputA.output : inputA.output.trimEnd(), inputB.output].join(separator)}
                : inputB
            : inputA
        : inputB
)

export const combine = combineFactory(simpleCombineTransform)

//
// worWrapCombine should smoothly (a) return wrapped/nested data where a wrapping is possible, (b) return naive combine (which may exceed line limits) where
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

//
// wrappedCombine should combine a list of results and return:
//    - The naive results
//    - A line-separated combination of all the naive results
//    - Nested results
//    - Property-Nested results
//
// (Provides needed functionality for printing wrapped tag-groups like Conditionals)
//

//
// TODO: Refactor wrapperCombine to operate across *ALL* arguments, rather than reducing
// in pairs, so that the expansion of results that needs to happen can happen once, 
// instead of N-1 times for N arguments.
//

const wrapperCombineFactoryAggregator = (combineTransform: CombineTransform, ...args: CombineFactoryLevel[]): PrintMapResult[] => {
    const allHaveNaive = !Boolean(args.find(({ naive }) => (naive.length === 0)))
    const allHaveNested = !Boolean(args.find(({ naive, nested }) => (naive.length === 0 && nested.length === 0)))
    const naiveMaxLevels = Math.max(...args.map(({ naive }) => (naive.length)))
    const nestedMaxLevels = Math.max(...args.map(({ nested }) => (nested.length)))
    const propertyNestedMaxLevels = Math.max(...args.map(({ propertyNested }) => (propertyNested.length)))
    const paddedLevels = args
        .map((level) => (padLevel(level, naiveMaxLevels, nestedMaxLevels, propertyNestedMaxLevels)))
        .map(({ naive, nested, propertyNested }) => ({
            naive: allHaveNaive ? naive : [],
            nested: allHaveNested ? nested : [],
            propertyNested
        }))
    return [
        ...combineLevels(combineTransform({ printMode: PrintMode.naive, separator: '' }))(...paddedLevels.map(({ naive }) => (naive))),
        ...combineLevels(combineTransform({ printMode: PrintMode.nested, separator: '\n' }))(...paddedLevels.map(({ naive }) => (naive))),
        ...combineLevels(combineTransform({ printMode: PrintMode.nested, separator: '\n' }))(...paddedLevels.map(({ nested }) => (nested))),
        ...combineLevels(combineTransform({ printMode: PrintMode.propertyNested, separator: '\n' }))(...paddedLevels.map(({ propertyNested }) => (propertyNested)))
    ]
}

export const wrapperCombine = combineFactory(simpleCombineTransform, wrapperCombineFactoryAggregator)

const separateLinesCombineFactoryAggregator = ({ force }: { force: boolean }) => (combineTransform: CombineTransform, ...args: CombineFactoryLevel[]): PrintMapResult[] => {
    const naiveSingleLines = args.map(({ naive }) => (naive.filter(({ output }) => (output.split('\n').length === 1))))
    const allHaveSingleLineNaive = !Boolean(naiveSingleLines.find((list) => (list.length === 0)))
    const maxNaiveLength = Math.max(...naiveSingleLines.map((list) => (list.length)))
    return [
        ...((allHaveSingleLineNaive && !force)
            ? combineLevels(combineTransform({ printMode: PrintMode.naive, separator: '' }))(...naiveSingleLines.map((list) => (padArray(list, maxNaiveLength))))
            : []),
        ...combineLevels(combineTransform({ printMode: PrintMode.nested, separator: '\n' }))(...args.map(({ naive, nested, propertyNested }) => ([[...naive, ...nested, ...propertyNested][0]])))
    ]
}

export const separateLinesCombine = (options: { force: boolean }) => combineFactory(simpleCombineTransform, separateLinesCombineFactoryAggregator(options))

export default combine
