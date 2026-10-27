import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { testLudicGraph } from '../positions/ludicGraph/testFixtures'
import { EphemeraLudicGraph } from '../positions/ludicGraph'
import type { CommandAttemptData } from './commandAttempt'
import { deterministicIntentChecks } from './discriminateIntent/deterministicChecks'
import type { SkeletonFill } from './enrich/objectManipulation/compileAttemptsFromSkeleton'
import type { ParseTokenDraft } from './enrich/objectManipulation/parse/parseToken'
import { planSkeleton, planTokens } from './enrich/objectManipulation/plan/planSkeleton'
import { parseCommand } from './parseCommand'

/**
 * Characterization corpus (skeletonMatcher Slice 0,
 * `taskPlanning/lambda/ephemera/dataSource/actions/AGENT.skeletonMatcher.planning.md`): each row pins,
 * as they are today, a command's readings on both routes and its `parseCommand` result.
 *
 * - `readings`: the attempts Plan makes for each segmentation, before the producer's filters
 *   (exact-fill precedence). `fastPath` is Plan over the tokens the fast path claims; `llmRoute`
 *   is Plan over the row's `parseTokens`, standing in for Parse (Slice 2 re-pointed both to the
 *   one engine; the digest is unchanged).
 * - `outcome`: the result, with the attempt digested the same way, and how often each LLM stub
 *   was reached (so the route taken shows).
 *
 * The digest is the stable contract: when a slice changes how readings are made (Slice 2's
 * tokens, Slice 5's retired Parse), it re-points the probe below and keeps the digest. A snapshot
 * this test rewrites is a corpus row that slice changes, and goes in its Progress row with why.
 *
 * Harness copied from `parseCommand.test.ts`'s ISS8203 characterization fixture.
 */
describe('skeletonMatcher characterization corpus (Slice 0)', () => {
    const CHARACTER = 'CHARACTER#123' as EphemeraCharacterId
    const ROOM = 'ROOM#Parlour' as EphemeraRoomId
    const NORTH_ROOM = 'ROOM#North' as EphemeraRoomId
    const TABLE = 'OBJECT#Table' as EphemeraObjectId
    const SAUCER = 'OBJECT#Saucer' as EphemeraObjectId
    const CUP = 'OBJECT#Cup' as EphemeraObjectId
    const BOX = 'OBJECT#Box' as EphemeraObjectId
    const COIN = 'OBJECT#Coin' as EphemeraObjectId
    const CLOTH = 'OBJECT#Cloth' as EphemeraObjectId
    const PIG_IN_A_BLANKET = 'OBJECT#PigInABlanket' as EphemeraObjectId
    const PLATE = 'OBJECT#Plate' as EphemeraObjectId
    const MAN_IN_THE_MOON = 'OBJECT#ManInTheMoon' as EphemeraObjectId
    const HELD_CUP = 'OBJECT#HeldCup' as EphemeraObjectId

    type ParseInput = Parameters<typeof parseCommand>[0]
    type Row = {
        command: string
        /** Distinguishes two rows on one command. */
        variant?: string
        parseTokens?: ParseTokenDraft[]
        input?: Partial<ParseInput>
        graphs?: Record<string, EphemeraLudicGraph>
        containers?: Record<string, string[]>
    }

    const text = (value: string): ParseTokenDraft => ({ type: 'text', text: value })
    const span = (value: string): ParseTokenDraft => ({ type: 'objectSpan', span: value })
    const catalogOf = (ids: Array<[EphemeraObjectId, string]>) => ids.map(([objectId, normalizedShortName]) => ({ objectId, normalizedShortName }))

    const ROOM_OBJECTS: Array<[EphemeraObjectId, string]> = [
        [TABLE, 'table'],
        [SAUCER, 'saucer'],
        [CUP, 'cup'],
        [BOX, 'box'],
        [COIN, 'coin'],
        [CLOTH, 'cloth'],
        [PIG_IN_A_BLANKET, 'pig in a blanket'],
        [PLATE, 'plate'],
        [MAN_IN_THE_MOON, 'man in the moon'],
    ]
    /** Flat: every object directly in the room. Nested worlds are the payoff tests' (each host's own graph). */
    const roomGraph = testLudicGraph(ROOM, {
        nodes: ROOM_OBJECTS.map(([universalKey]) => ({ tag: 'Object' as const, universalKey })),
    })
    // Presence ids are minted UUIDs (spread's `extend`): snapshot them as placeholders numbered by
    // first appearance, so a snapshot still shows which ids are shared and which are distinct.
    const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g
    let mintedIds = new Map<string, string>()
    beforeEach(() => {
        mintedIds = new Map()
    })
    expect.addSnapshotSerializer({
        test: (value) => typeof value === 'string' && new RegExp(UUID.source).test(value),
        serialize: (value: string) => `"${value.replace(UUID, (uuid) => {
            if (!mintedIds.has(uuid)) {
                mintedIds.set(uuid, `<minted id ${mintedIds.size + 1}>`)
            }
            return mintedIds.get(uuid)!
        })}"`,
    })

    const holdingCup: Pick<Row, 'input' | 'graphs' | 'containers'> = {
        input: { heldInventoryCatalog: catalogOf([[HELD_CUP, 'cup']]) },
        containers: { [HELD_CUP]: [CHARACTER] },
        graphs: { [CHARACTER]: testLudicGraph(CHARACTER, { nodes: [{ tag: 'Object', universalKey: HELD_CUP }] }) },
    }

    /** A referent as its span (and what it grounded to), or its type when it names no span. */
    const referentOf = (referent: Record<string, any>): string => {
        const { referentType, span: spanText, groundedId, referentTarget, stableRefKey: _key, shortName: _name, ...rest } = referent
        const head = referentType === 'objectSpan'
            ? `[${spanText}]${groundedId ? `=${groundedId}` : ''}`
            : `${referentType}${referentTarget ? `(${referentOf(referentTarget)})` : ''}`
        return Object.keys(rest).length > 0 ? `${head}${JSON.stringify(rest)}` : head
    }
    const valueOf = (value: unknown): string => (
        value !== null && typeof value === 'object' && 'referentType' in value
            ? referentOf(value as Record<string, any>)
            : typeof value === 'object' ? JSON.stringify(value) : String(value)
    )
    /** One action: its kind, its step's kind and primitive (or predicate), then every other field. */
    const actionOf = (action: CommandAttemptData['actions'][number]): string => {
        const { kind } = action
        const desiredResult = 'desiredResult' in action ? action.desiredResult : undefined
        if (!desiredResult) {
            return kind
        }
        const { kind: stepKind, primitive, predicate, ...fields } = desiredResult as Record<string, unknown>
        const name = [stepKind, primitive ?? predicate].filter((part) => part !== undefined).join(' ')
        const args = Object.entries(fields).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${valueOf(value)}`)
        return `${kind}: ${name}(${args.join(', ')})`
    }
    const attemptOf = (attempt: CommandAttemptData): string => attempt.actions.map(actionOf).join('; ')
    const skeletonOf = (skeleton: readonly ParseTokenDraft[]): string => (
        skeleton.map((token) => token.type === 'text' ? token.text : `[${token.span}]`).join(' ')
    )
    const readingsOf = (fills: readonly SkeletonFill[]): string[] => fills.flatMap(({ skeleton, attempts }) => [
        skeletonOf(skeleton),
        ...attempts.map((attempt) => `  ${attemptOf(attempt.toJSON())}`),
    ])

    const inputOf = (row: Row): ParseInput => ({
        command: row.command,
        characterId: CHARACTER,
        hostRoomId: ROOM,
        roomExits: [{ normalizedName: 'north', targetId: NORTH_ROOM }],
        roomObjectCatalog: catalogOf(ROOM_OBJECTS),
        ...row.input,
    } as ParseInput)

    /** The probe: Plan over the fast path's tokens, and over the row's Parse skeleton. */
    const readings = (row: Row) => {
        const fast = deterministicIntentChecks(inputOf(row))
        return {
            fastPath: fast === null
                ? 'no deterministic answer'
                : fast.type === 'ObjectManipulationIntent'
                    ? readingsOf(planTokens(fast.tokens, row.command))
                    : fast.type,
            ...(row.parseTokens ? { llmRoute: readingsOf(planSkeleton(row.parseTokens, row.command).fills) } : {}),
        }
    }

    /** The result, with every attempt (the answer's, and a Consult's root fills) digested. */
    const digestResult = (result: Record<string, any>): Record<string, unknown> => {
        const { attempt, root, ...rest } = result
        return {
            ...rest,
            ...(attempt ? { attempt: attemptOf(attempt), referents: (attempt as CommandAttemptData).referents.map(({ id, refKey }) => `${refKey}=${id}`) } : {}),
            ...(root ? {
                root: {
                    command: root.command,
                    fills: root.fills.map(({ skeleton, attempts }: { skeleton: ParseTokenDraft[]; attempts: CommandAttemptData[] }) => [skeletonOf(skeleton), ...attempts.map((each) => `  ${attemptOf(each)}`)]),
                },
            } : {}),
        }
    }

    /** Runs `parseCommand` with every LLM and positions dependency stubbed, counting each LLM stub's calls. */
    const outcome = async (row: Row) => {
        const graphs: Record<string, EphemeraLudicGraph> = { [ROOM]: roomGraph, ...row.graphs }
        const stubs = {
            classify: jest.fn().mockResolvedValue({ success: true, body: '{"type":"Command","confidence":0.9}' }),
            parse: jest.fn().mockResolvedValue({ success: true, body: JSON.stringify({ tokens: row.parseTokens ?? [] }) }),
            enrich: jest.fn(),
            acme: jest.fn().mockResolvedValue({ success: false, errorMessage: 'acme stubbed as unavailable' }),
            embedSpan: jest.fn().mockResolvedValue({ success: false, errorMessage: 'embedding stubbed as unavailable' }),
        }
        const result = await parseCommand(inputOf(row), {
            invokeBedrockParseCommandImpl: stubs.classify,
            invokeBedrockObjectManipulationParseImpl: stubs.parse,
            invokeBedrockObjectManipulationEnrichImpl: stubs.enrich,
            invokeBedrockAcmeOrderEnrichImpl: stubs.acme,
            embedSpan: stubs.embedSpan,
            countCoyotePlacedObjectsAcrossRoomsDeps: { getGameRooms: async () => [] },
            objectManipulationPositionsReadDeps: {
                getMembershipContainers: jest.fn().mockImplementation(async (id: string) => (
                    row.containers?.[id] ?? (id === CHARACTER ? [] : [ROOM])
                )),
                getLudicGraph: jest.fn().mockImplementation(async (hostId: string) => (
                    graphs[hostId] ?? testLudicGraph(hostId as EphemeraRoomId)
                )),
            },
        })
        return {
            result: digestResult(result as Record<string, any>),
            stubCalls: Object.fromEntries(Object.entries(stubs).map(([name, stub]) => [name, stub.mock.calls.length])),
        }
    }

    const rows: Row[] = [
        // The plan's payoff
        { command: 'put pig in a blanket on the plate on the table', parseTokens: [text('put'), span('pig'), text('in'), span('a blanket'), text('on'), span('the plate'), text('on'), span('the table')] },
        // qualifiedTakePayoff
        { command: 'take cup on saucer on table', parseTokens: [text('take'), span('cup'), text('on'), span('saucer'), text('on'), span('table')] },
        { command: 'take cup from table', parseTokens: [text('take'), span('cup'), text('from'), span('table')] },
        { command: 'take coin out box', parseTokens: [text('take'), span('coin'), text('out'), span('box')] },
        { command: 'put cup on saucer on table', parseTokens: [text('put'), span('cup'), text('on'), span('saucer'), text('on'), span('table')] },
        // phraseCoveragePayoff
        { command: 'get the cup', parseTokens: [text('get'), span('the cup')] },
        { command: 'take unicorn', parseTokens: [text('take'), span('unicorn')] },
        { command: 'take man in the moon from table', parseTokens: [text('take'), span('man'), text('in'), span('the moon'), text('from'), span('table')] },
        { command: 'drop the cup in the box', parseTokens: [text('drop'), span('the cup'), text('in'), span('the box')], ...holdingCup },
        { command: 'drop cup', parseTokens: [text('drop'), span('cup')], ...holdingCup },
        // The fast path's retired gates: `take hold`, and `get` needing a room label
        { command: 'take hold of the cup', parseTokens: [text('take hold of'), span('the cup')] },
        { command: 'get cup', parseTokens: [text('get'), span('cup')] },
        // What the `get` gate guarded (`up` ranking near "cup") is Identify's evidence to weigh
        { command: 'get up', parseTokens: [text('get'), span('up')] },
        // Shapes the templates read partly, or not at all
        { command: 'get cup under table', parseTokens: [text('get'), span('cup'), text('under'), span('table')] },
        { command: 'put coin hurriedly into box', parseTokens: [text('put'), span('coin'), text('hurriedly into'), span('box')] },
        { command: 'spread cloth over table', parseTokens: [text('spread'), span('cloth'), text('over'), span('table')] },
        { command: 'look at the cup on the table', parseTokens: [text('look at'), span('the cup'), text('on'), span('the table')] },
        // Punctuation (Slice 2: a span slot merges across a mark)
        { command: 'take cup.', parseTokens: [text('take'), span('cup')] },
        { command: 'take cup, then look', parseTokens: [text('take'), span('cup'), text(', then look')] },
        { command: 'order anvil, rocket', parseTokens: [text('order'), span('anvil'), text(','), span('rocket')] },
        // The guard cap (Slice 2): more than six closed-set prepositions get no deterministic reading, so the command climbs
        { command: 'take a on b on c on d on e on f on g on h', parseTokens: [text('take'), span('a'), text('on'), span('b'), text('on'), span('c'), text('on'), span('d'), text('on'), span('e'), text('on'), span('f'), text('on'), span('g'), text('on'), span('h')] },
        // The fixed-word intent rows, Navigation and AcmeOrder (SM-9, SM-12)
        { command: 'look' },
        { command: 'help' },
        { command: 'help me' },
        { command: 'home' },
        { command: 'go home' },
        { command: 'go home', variant: 'a home exit', input: { roomExits: [{ normalizedName: 'north', targetId: NORTH_ROOM }, { normalizedName: 'home', targetId: 'ROOM#Home' as EphemeraRoomId }] } },
        { command: 'wait' },
        { command: 'predict' },
        { command: 'go north', parseTokens: [text('go'), span('north')] },
        { command: 'north', parseTokens: [span('north')] },
        { command: 'enter box', parseTokens: [text('enter'), span('box')] },
        { command: 'order rocket skates', parseTokens: [text('order'), span('rocket skates')] },
    ]

    it.each(rows.map((row) => [row.variant ? `${row.command} (${row.variant})` : row.command, row] as const))('%s', async (_name, row) => {
        expect({ readings: readings(row), outcome: await outcome(row) }).toMatchSnapshot()
    })
})
