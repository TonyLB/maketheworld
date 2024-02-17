import { PrintMapResult, PrintMode } from "../baseClasses";

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
export const combine = (...args: PrintMapResult[][]): PrintMapResult[] => {
    return args.reduce<PrintMapResult[]>((previous, output) => {
        if (previous.length === 0) {
            return output
        }
        const previousNaive = previous.filter(({ printMode }) => (printMode === PrintMode.naive))
        const previousNested = previous.find(({ printMode }) => (printMode === PrintMode.nested))
            ? previous.filter(({ printMode }) => (printMode === PrintMode.nested))
            : previousNaive
        const previousPropertyNested = previous.find(({ printMode }) => (printMode === PrintMode.propertyNested))
            ? previous.filter(({ printMode }) => (printMode === PrintMode.propertyNested))
            : previousNested
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
        const combineTransform = (printMode: PrintMode, separator: string, ignoreWhitespace?: boolean) => (inputA: PrintMapResult, inputB: PrintMapResult) => (
            (!ignoreWhitespace || inputB.output.trim())
                ? inputA.output
                    ? { printMode, output: [separator === '' ? inputA.output : inputA.output.trimEnd(), inputB.output].join(separator)}
                    : inputB
                : inputA
        )
        return [
            // Combine naive, if available, on a single line
            ...combineLevel(previousNaive, currentNaive, combineTransform(PrintMode.naive, '')),
            ...(Boolean([...previous, ...output].find(({ printMode }) => (printMode === PrintMode.nested))) ? combineLevel(previousNested, currentNested, combineTransform(PrintMode.nested, '\n')) : []),
            ...(Boolean([...previous, ...output].find(({ printMode }) => (printMode === PrintMode.propertyNested))) ? combineLevel(previousPropertyNested, currentPropertyNested, combineTransform(PrintMode.nested, '\n')) : [])
        ]

    }, [])
}

export default combine
