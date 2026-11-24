//
// A CompositionProbe response for reading (`read-chains`): each chain hop by hop, its plans as a generator reads them. It builds nothing
// again: a hop's plan is the one the run left, not a replay of its reply.
//
import { renderPlanForGenerator, type ActionPlan } from '../oracleLoop/actionPlan'
import type { PieceRequest, PieceState } from '../pieceProbe/piecePart'
import type { Hop } from './loopState'
import type { StopReason } from './next'

/** A response's `read`, as its JSON holds it: a case's chains. */
export type ChainGroup = { case: string; source: string; start: PieceState; chains: { repeat: number; hops: Hop[]; stop: StopReason }[] }

export type ChainsTextOptions = { /** Each live hop's rendered text too. */ prompts?: boolean }

const requestText = ({ kind, target, missing }: PieceRequest): string => `${kind} of ${target}: ${missing}`

const stopText = (stop: StopReason): string => {
    switch (stop.reason) {
        case 'verdict': return `verdict, ${stop.verdict}`
        case 'formFault': return `form fault at ${stop.piece}: ${stop.problems.join('; ')}`
        case 'error': return `error at ${stop.piece}: ${stop.error}`
        case 'nothingAnswers': return `nothing answers${stop.piece === undefined ? '' : ` (${stop.piece})`}${stop.request === undefined ? '' : `: ${requestText(stop.request)}`}`
        case 'cap': return `the cap, ${stop.cap} hops`
    }
}

const gaveText = (gave: NonNullable<Hop['gave']>): string => ('request' in gave ? `request, ${requestText(gave.request)}` : `verdict, ${gave.verdict}`)

const planText = (plan: ActionPlan): string => renderPlanForGenerator(plan)

const samePlan = (one: ActionPlan, other: ActionPlan): boolean => JSON.stringify(one) === JSON.stringify(other)

/** A hop's lines. The plan before it says whether it changed the plan: a JSON response keeps no identity. */
const hopText = (hop: Hop, index: number, before: ActionPlan, { prompts = false }: ChainsTextOptions): string => {
    const { piece, mocked, entry, request, inputs, unread, rendered, reply, problems = [], error, gave, plan } = hop
    return [
        `### ${index + 1}. ${piece}${mocked ? ` (mocked${entry === undefined ? '' : `: ${entry}`})` : ''}`,
        ...(request === undefined ? [] : [`asked: ${requestText(request)}`]),
        ...(unread === undefined ? [] : [`unread: ${Object.entries(unread).map(([field, said]) => `${field} "${said}"`).join(', ')}`]),
        ...(inputs === undefined ? [] : [`inputs ${inputs.hash}`]),
        ...(prompts && rendered !== undefined ? [`prompt:\n${rendered}`] : []),
        ...(reply === undefined ? [] : [`reply (${reply.length} characters):\n${reply}`]),
        ...(problems.length === 0 ? [] : [`form: ${problems.join('; ')}`]),
        ...(error === undefined ? [] : [`error: ${error}`]),
        ...(gave === undefined ? [] : [`gave: ${gaveText(gave)}`]),
        ...(samePlan(plan, before) ? [] : [`plan after:\n${planText(plan)}`]),
    ].join('\n')
}

/** Each case's start, then its chains in order. */
export const chainsText = (groups: readonly ChainGroup[], options: ChainsTextOptions = {}): string => groups.flatMap(({ case: id, source, start, chains }) => [
    `# ${id} (${source})\nthings: ${start.things.join(', ')}; also shown: ${start.alsoShown.join(', ')}\nstart:\n${planText(start.plan)}`,
    ...chains.flatMap(({ repeat, hops, stop }) => [
        `## ${id}, repeat ${repeat}: ${stopText(stop)} (${hops.length} hops)`,
        ...hops.map((hop, index) => hopText(hop, index, index === 0 ? start.plan : hops[index - 1].plan, options)),
    ]),
]).join('\n\n')

/** A saved response's chains, or why it has none. Its body is a JSON string or an object, depending on how it was saved; a bare body is read as it is. */
export const readChains = (saved: unknown): ChainGroup[] | string => {
    const { body = saved } = saved as { body?: unknown }
    const { read, cap, error } = (typeof body === 'string' ? JSON.parse(body) : body) as { read?: unknown; cap?: unknown; error?: string }
    return Array.isArray(read) && cap !== undefined ? read as ChainGroup[] : `not a CompositionProbe response${error === undefined ? '' : `: ${error}`}`
}
