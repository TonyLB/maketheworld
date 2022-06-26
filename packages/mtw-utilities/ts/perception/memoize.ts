import evaluateCode from '../computation/sandbox.js'

let memoSpace = {}

export const clearMemoSpace = (asset?: string) => {
    if (asset) {
        memoSpace[asset] = {}
    }
    else {
        memoSpace = {}
    }
}

export const memoizedEvaluate = (asset, expression, state) => {
    if (memoSpace[asset] && memoSpace[asset][expression]) {
        return memoSpace[asset][expression]
    }

    let outcome = '{#ERROR}'
    try {
        outcome = evaluateCode(`return (${expression})`)(state)
    }
    catch(e) {
        outcome = '{#ERROR}'
    }
    memoSpace[asset] = {
        ...(memoSpace[asset] || {}),
        [expression]: outcome
    }
    return outcome
}

