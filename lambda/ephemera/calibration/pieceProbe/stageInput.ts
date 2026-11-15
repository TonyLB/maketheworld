//
// Golden and lifted inputs for a later stage (AGENT.nonRuleCell.planning.md, How we work; the user's design, 2026-11-15). A piece fed by
// an earlier stage's output gives each cell two sources for that part: `golden`, hand-written in the earlier stage's contract form, and
// `lifted`, a real output of the earlier stage with its source batch. A payload names which with `upstream`. There is no default, and a
// cell without the named source throws at render, so the probe refuses the payload as a cell-data error.
//
export const UPSTREAM_SOURCES = ['golden', 'lifted'] as const
export type UpstreamSource = typeof UPSTREAM_SOURCES[number]

/**
 * One cell's earlier-stage part, from either source. `golden` notes how it was written (an interim golden adopted from a lifted value
 * says so). `lifted` names the batch and repeat it came from.
 */
export type StageInput<T> = {
    golden?: { value: T; note?: string }
    lifted?: { value: T; source: string }
}

export type UpstreamOptions = { upstream: UpstreamSource }

/** The option every such piece takes: `{ upstream: 'golden' | 'lifted' }`, named in every payload. */
export const parseUpstreamOptions = (value: unknown): UpstreamOptions | string => {
    const shape = "options must be { upstream: 'golden' | 'lifted' }, named in every payload"
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return shape
    }
    const { upstream, ...rest } = value as Record<string, unknown>
    return Object.keys(rest).length === 0 && (UPSTREAM_SOURCES as readonly unknown[]).includes(upstream) ? { upstream: upstream as UpstreamSource } : shape
}

/**
 * The named source's value. Throws when the cell has none, or when `fits` refuses it: a lifted value recorded under an older contract
 * counts as missing for the current one.
 */
export const pickStageInput = <T>(input: StageInput<T>, upstream: UpstreamSource, fits: (value: T) => string | undefined = () => undefined): T => {
    const chosen = input[upstream]
    if (chosen === undefined) {
        throw new Error(`no ${upstream} value for this cell`)
    }
    const misfit = fits(chosen.value)
    if (misfit !== undefined) {
        throw new Error(`the ${upstream} value doesn't fit the current contract: ${misfit}`)
    }
    return chosen.value
}
