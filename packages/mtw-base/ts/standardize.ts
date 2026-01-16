export class StandardizerError extends Error {}
export class MergeConflictError extends StandardizerError {
    constructor(message?: string) {
        super(message ?? 'Merge conflict')
    }
}
export class TagMismatchError extends StandardizerError {
    constructor(expected: string, actual: string) {
        super(`Node has ${actual} tag, expected ${expected}`)
    }
}