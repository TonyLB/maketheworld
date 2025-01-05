export class StandardizerError extends Error {}
export class MergeConflictError extends StandardizerError {
    constructor(message?: string) {
        super(message ?? 'Merge conflict')
    }
}
