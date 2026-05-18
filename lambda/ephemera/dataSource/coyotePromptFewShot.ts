/** Shared core/iconic few-shot options for Coyote LLM prompt builders. */

export type IncludeIconicFewShotsOptions = {
    /** When false, omit harness-aligned iconic few-shots (live harness LLM eval). Default true. */
    includeIconicFewShots?: boolean
}

/** Default true when the flag is omitted. */
export function resolveIncludeIconicFewShots(options?: IncludeIconicFewShotsOptions): boolean {
    return options?.includeIconicFewShots !== false
}

export function joinFewShotBlocks(core: string, iconic: string, includeIconic: boolean): string {
    if (includeIconic) {
        return `${core}\n\n${iconic}`
    }
    return core
}
