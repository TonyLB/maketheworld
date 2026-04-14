/**
 * Parser result for action ingress. Extend with non-error variants as the contract grows.
 */
export type ParseCommandErrorResult = {
    type: 'Error'
    errorMessage?: string
}

export type ParseCommandResult =
    | ParseCommandErrorResult

export function isParseCommandErrorResult(
    result: ParseCommandResult
): result is ParseCommandErrorResult {
    return result.type === 'Error'
}

export type ParseCommandInput = {
    command: string
}

/**
 * Stub: returns a fixed Error-shaped result until the LLM / validation pipeline is wired.
 */
export async function parseCommand(_input: ParseCommandInput): Promise<ParseCommandResult> {
    return { type: 'Error' }
}
