enum ShortestCommonSupersetDirection {
    left,
    up,
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
export const shortestCommonSupersequence = (listA: number[], listB: number[]): number[] => {
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
            direction: ShortestCommonSupersetDirection.up,
            length: i
        }
    }
    for(let j=0; j<listB.length + 1; j++) {
        memoArray[0][j] = {
            direction: ShortestCommonSupersetDirection.left,
            length: j
        }
    }
    const valueRelative = (i: number, j: number, direction: ShortestCommonSupersetDirection): number => {
        switch(direction) {
            case ShortestCommonSupersetDirection.up:
                return (memoArray[i-1][j] || []).length
            case ShortestCommonSupersetDirection.left:
                return (memoArray[i][j-1] || []).length
            case ShortestCommonSupersetDirection.both:
                return (memoArray[i-1][j-1] || []).length
        }
    }
    for(let i=1; i<=listA.length; i++) {
        for(let j=1; j<=listB.length; j++) {
            let direction: ShortestCommonSupersetDirection | undefined
            if (listA[i - 1] === listB[j - 1]) {
                direction = ShortestCommonSupersetDirection.both
            }
            else {
                direction = valueRelative(i, j, ShortestCommonSupersetDirection.up) < valueRelative(i, j, ShortestCommonSupersetDirection.left) ? ShortestCommonSupersetDirection.up : ShortestCommonSupersetDirection.left
            }
            memoArray[i][j] = {
                direction,
                length: valueRelative(i, j, direction) + 1
            }
        }
    }
    let i = listA.length
    let j = listB.length
    let backtrack: number[] = []
    while (i > 0 || j > 0) {
        switch(memoArray[i][j]?.direction) {
            case ShortestCommonSupersetDirection.both:
                j--
            case ShortestCommonSupersetDirection.up:
                i--
                backtrack.unshift(listA[i])
                break
            case ShortestCommonSupersetDirection.left:
                j--
                backtrack.unshift(listB[j])
        }
    }
    return backtrack
}

export default shortestCommonSupersequence
