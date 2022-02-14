import evaluateCode from '../computation/sandbox.js'

let memoSpace = {}

export const clearMemoSpace = () => {
    memoSpace = {}
}

export const memoizedEvaluate = (expression, state) => {
    if (memoSpace[expression]) {
        return expression
    }

    try {
        const outcome = evaluateCode(`return (${expression})`)(state)
        memoSpace[expression] = outcome
        return outcome
    }
    catch(e) {
        const outcome = '{#ERROR}'
        memoSpace[expression] = outcome
        return outcome
    }
}

