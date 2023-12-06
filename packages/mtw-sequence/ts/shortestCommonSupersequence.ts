export enum ShortestCommonSupersetDirection {
    B,
    A,
    both
}

type ShortestCommonSupersetDynamicMemo = {
    direction: ShortestCommonSupersetDirection;
    length: number;
}

//
// shortestCommonSupersequence returns the shortest sequence that contains both listA and
// listB shuffled into it, each in the same order of appearance.  Where there is a choice
// between two equally valid orderings, the one that places the elements of listA earlier
// in the sequence is chosen arbitrarily.
//
export type ShortestCommonSupersetOptions = {
    showSource?: boolean;
}
export function shortestCommonSupersequence (listA: number[], listB: number[], options: ShortestCommonSupersetOptions): { value: number, source: ShortestCommonSupersetDirection }[]
export function shortestCommonSupersequence(listA: number[], listB: number[]): number[]
export function shortestCommonSupersequence (listA: number[], listB: number[], options: ShortestCommonSupersetOptions = {}): number[] | { value: number, source: ShortestCommonSupersetDirection }[] {
    if (listA.length === 0) {
        return listB
    }
    if (listB.length === 0) {
        return listA
    }
    let memoArray: (ShortestCommonSupersetDynamicMemo | undefined)[][] = Array(listA.length + 1).fill(0).map(() => (Array(listB.length + 1).fill(undefined)))
    //
    // Fill trivial top row and leftmost column
    //
    for(let i=0; i<listA.length + 1; i++) {
        memoArray[i][0] = {
            direction: ShortestCommonSupersetDirection.A,
            length: i
        }
    }
    for(let j=0; j<listB.length + 1; j++) {
        memoArray[0][j] = {
            direction: ShortestCommonSupersetDirection.B,
            length: j
        }
    }
    const valueRelative = (i: number, j: number, direction: ShortestCommonSupersetDirection): number => {
        switch(direction) {
            case ShortestCommonSupersetDirection.A:
                return (memoArray[i-1][j] || []).length
            case ShortestCommonSupersetDirection.B:
                return (memoArray[i][j-1] || []).length
            case ShortestCommonSupersetDirection.both:
                return (memoArray[i-1][j-1] || []).length
        }
    }
    for(let i=1; i<=listA.length; i++) {
        for(let j=1; j<=listB.length; j++) {
            let direction: ShortestCommonSupersetDirection | undefined
            //
            // TODO: Refactor to include an option to measure the value of a sequence with an idiomatic function
            // rather than assume that shorter length is always optimal (helpful for preventing sequences that
            // would have unbalanced effects on the underlying structure they represent)
            //
            if (listA[i - 1] === listB[j - 1]) {
                direction = ShortestCommonSupersetDirection.both
            }
            else {
                direction = valueRelative(i, j, ShortestCommonSupersetDirection.A) < valueRelative(i, j, ShortestCommonSupersetDirection.B) ? ShortestCommonSupersetDirection.A : ShortestCommonSupersetDirection.B
            }
            memoArray[i][j] = {
                direction,
                length: valueRelative(i, j, direction) + 1
            }
        }
    }
    let i = listA.length
    let j = listB.length
    let backtrack: { value: number, source: ShortestCommonSupersetDirection }[] = []
    while (i > 0 || j > 0) {
        switch(memoArray[i][j]?.direction) {
            case ShortestCommonSupersetDirection.both:
                j--
                i--
                backtrack.unshift({ value: listA[i], source: ShortestCommonSupersetDirection.both })
                break
            case ShortestCommonSupersetDirection.A:
                i--
                backtrack.unshift({ value: listA[i], source: ShortestCommonSupersetDirection.A })
                break
            case ShortestCommonSupersetDirection.B:
                j--
                backtrack.unshift({ value: listB[j], source: ShortestCommonSupersetDirection.B })
        }
    }
    if (options.showSource) {
        return backtrack
    }
    return backtrack.map(({ value }) => (value))
}

export default shortestCommonSupersequence
