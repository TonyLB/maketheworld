import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { MessageBus } from '../../messageBus/baseClasses'
import { buildHypothesisPromptParts } from './buildHypothesisPrompt'
import {
    COYOTE_ENGINE_TEST_FIXTURES,
    type CoyoteEngineTestFixture,
} from './coyoteEngineTestFixtures'
import {
    invokeBedrockHypothesis,
    type InvokeBedrockHypothesisResult,
} from './invokeBedrockHypothesis'

export type RunCoyoteEngineTestHarnessDeps = {
    characterId: EphemeraCharacterId
    messageBus: Pick<MessageBus, 'send'>
    fixtures?: CoyoteEngineTestFixture[]
    testBatchSize?: number
    invokeBedrockHypothesisImpl?: typeof invokeBedrockHypothesis
    now?: () => number
}

const COYOTE_ROOM_IDS: EphemeraRoomId[] = [
    'ROOM#VORTEX',
    'ROOM#STRAIGHTAWAY',
    'ROOM#CLIFFTOP',
    'ROOM#CORNER',
    'ROOM#BRIDGE',
]

function normalizeFixtureRoomObjects(
    fixture: CoyoteEngineTestFixture
): Record<EphemeraRoomId, string[]> {
    return Object.fromEntries(
        COYOTE_ROOM_IDS.map((roomId) => [roomId, fixture.roomObjectsByRoom[roomId] ?? []])
    ) as Record<EphemeraRoomId, string[]>
}

function normalizeHypothesisBody(body: string): string | null {
    const trimmed = body.trim()
    if (!trimmed) {
        return null
    }
    const openFence = /^```(?:text)?\s*\n?/i
    const closeFence = /\n?```\s*$/i
    const unwrapped = trimmed.replace(openFence, '').replace(closeFence, '').trim()
    return unwrapped || null
}

function formatUsageLine(result: InvokeBedrockHypothesisResult): string {
    if (!result.success || !result.usage) {
        return 'usage: (none)'
    }
    const {
        inputTokens,
        outputTokens,
        totalTokens,
        cacheReadInputTokens,
        cacheWriteInputTokens,
    } = result.usage
    const cacheRead = cacheReadInputTokens ?? 0
    const cacheWrite = cacheWriteInputTokens ?? 0
    return `usage: input=${inputTokens} output=${outputTokens} total=${totalTokens} cacheRead=${cacheRead} cacheWrite=${cacheWrite}`
}

function formatFixtureMessage(args: {
    fixture: CoyoteEngineTestFixture
    index: number
    total: number
    hypothesisLine: string
    elapsedMs: number
    usageLine: string
    errorMessage?: string
}): string {
    const {
        fixture,
        index,
        total,
        hypothesisLine,
        elapsedMs,
        usageLine,
        errorMessage,
    } = args
    const heading = `${index + 1}/${total} ${fixture.id}${fixture.label ? ` - ${fixture.label}` : ''}`
    const lines = [
        heading,
        hypothesisLine,
        `elapsedMs: ${elapsedMs}`,
        usageLine,
    ]
    if (errorMessage) {
        lines.push(`error: ${errorMessage}`)
    }
    return lines.join('\n')
}

export async function runCoyoteEngineTestHarness(deps: RunCoyoteEngineTestHarnessDeps): Promise<void> {
    const fixtures = deps.fixtures ?? COYOTE_ENGINE_TEST_FIXTURES
    if (fixtures.length === 0) {
        return
    }
    const testBatchSize = Math.max(1, Math.floor(deps.testBatchSize ?? 1))
    const invoke = deps.invokeBedrockHypothesisImpl ?? invokeBedrockHypothesis
    const now = deps.now ?? (() => Date.now())
    let nextIndex = 0

    const runFixture = async (fixture: CoyoteEngineTestFixture, index: number): Promise<void> => {
        const startMs = now()
        try {
            const prompt = buildHypothesisPromptParts({
                roomObjectsByRoom: normalizeFixtureRoomObjects(fixture),
            })
            const result = await invoke(prompt)
            const hypothesisLine = result.success
                ? (normalizeHypothesisBody(result.body) ?? 'Hypothesis: Stubbed')
                : 'Hypothesis: Stubbed'
            const elapsedMs = Math.max(0, now() - startMs)
            const message = formatFixtureMessage({
                fixture,
                index,
                total: fixtures.length,
                hypothesisLine,
                elapsedMs,
                usageLine: formatUsageLine(result),
                errorMessage: result.success ? undefined : result.errorMessage,
            })
            deps.messageBus.send({
                type: 'PublishMessage',
                targets: [deps.characterId],
                displayProtocol: 'WorldOOCMessage',
                message: [message],
            })
        }
        catch (error) {
            const elapsedMs = Math.max(0, now() - startMs)
            const errorMessage = error instanceof Error ? error.message : String(error)
            const message = formatFixtureMessage({
                fixture,
                index,
                total: fixtures.length,
                hypothesisLine: 'Hypothesis: Stubbed',
                elapsedMs,
                usageLine: 'usage: (none)',
                errorMessage,
            })
            deps.messageBus.send({
                type: 'PublishMessage',
                targets: [deps.characterId],
                displayProtocol: 'WorldOOCMessage',
                message: [message],
            })
        }
    }

    const worker = async (): Promise<void> => {
        while (nextIndex < fixtures.length) {
            const index = nextIndex
            nextIndex += 1
            await runFixture(fixtures[index], index)
        }
    }

    const workerCount = Math.min(testBatchSize, fixtures.length)
    await Promise.all(Array.from({ length: workerCount }, () => worker()))
}

