//
// Golden and lifted inputs for a later stage (AGENT.nonRuleCell.planning.md, How we work; the user's design, 2026-11-15). A piece fed by
// an earlier stage's output gives each cell two sources for that part: `golden`, hand-written in the earlier stage's contract form, and
// `lifted`, a real output of the earlier stage with its source batch. A payload names which with `upstream`. There is no default, and a
// cell without the named source throws at render, so the probe refuses the payload as a cell-data error. A lifted value of a stage that
// answered an earlier one records what it `consumed` (the pairing rule, Slice B), so it is shown with the very value it answered.
//
import { textHash } from '../textHash'

export const UPSTREAM_SOURCES = ['golden', 'lifted'] as const
export type UpstreamSource = typeof UPSTREAM_SOURCES[number]

/** What a lifted value answered: the source of the stage before it, and the hash of the value it read (`stageValueHash`). */
export type Consumed = { upstream: UpstreamSource; hash: string }

/**
 * One cell's earlier-stage part, from either source. `golden` notes how it was written (an interim golden adopted from a lifted value
 * says so). `lifted` names the batch and repeat it came from and, for a stage that answered an earlier one, what it consumed.
 */
export type StageInput<T> = {
    golden?: { value: T; note?: string }
    lifted?: { value: T; source: string; consumed?: Consumed }
}

/** JSON with every object's keys sorted, so a value's hash doesn't turn on the order its fields were written in. */
const sortedJson = (value: unknown): string => JSON.stringify(value, (_key, inner: unknown) => (
    typeof inner === 'object' && inner !== null && !Array.isArray(inner)
        ? Object.fromEntries(Object.entries(inner as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
        : inner
))

/** A stage value's hash, as a lifted value's `consumed` records it. */
export const stageValueHash = (value: unknown): string => textHash(sortedJson(value))

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

/** Each value's check against the current contract, as `pickStageInput` takes it. */
export type PairFits<Earlier, Later> = { earlier?: (value: Earlier) => string | undefined; later?: (value: Later) => string | undefined }

/**
 * A later stage's value with the earlier value it answered, for a stage reading both (the pairing rule, Slice B). `golden` takes both
 * golden values, hand-written all the way up. `lifted` takes the later stage's lifted value, then the earlier value from the source it
 * `consumed`, and checks that value's hash: an earlier value edited since the later one was recorded throws, so the pair breaks loudly.
 */
export const pickPaired = <Earlier, Later>(
    earlier: StageInput<Earlier>,
    later: StageInput<Later>,
    upstream: UpstreamSource,
    fits: PairFits<Earlier, Later> = {},
): { earlier: Earlier; later: Later } => {
    if (upstream === 'golden') {
        return { earlier: pickStageInput(earlier, 'golden', fits.earlier), later: pickStageInput(later, 'golden', fits.later) }
    }
    const value = pickStageInput(later, 'lifted', fits.later)
    const consumed = later.lifted?.consumed
    if (consumed === undefined) {
        throw new Error('the lifted value records nothing it consumed, so what it answered is unknown')
    }
    const answered = pickStageInput(earlier, consumed.upstream, fits.earlier)
    const hash = stageValueHash(answered)
    if (hash !== consumed.hash) {
        throw new Error(`the lifted value answered a different ${consumed.upstream} value (consumed ${consumed.hash}, now ${hash})`)
    }
    return { earlier: answered, later: value }
}
