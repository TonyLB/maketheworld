jest.mock('../hypothesis/invokeBedrockHypothesis', () => ({
    __esModule: true,
    invokeBedrockHypothesis: jest.fn(),
}))

import { harnessRoomObjects } from '../../testHarness/coyoteEngineTestFixtures'
import { generatePlanOutcome } from './generatePlanOutcome'
import { invokeBedrockHypothesis } from '../hypothesis/invokeBedrockHypothesis'

const invokeBedrockHypothesisMock = invokeBedrockHypothesis as jest.MockedFunction<typeof invokeBedrockHypothesis>

describe('generatePlanOutcome', () => {
    const getGameRooms = jest.fn<Promise<string[]>, []>()
    const getRoomMeta = jest.fn()
    const getIntentRecord = jest.fn()

    beforeEach(() => {
        jest.clearAllMocks()
        getGameRooms.mockResolvedValue(['VORTEX', 'STRAIGHTAWAY'])
        getRoomMeta.mockImplementation(async (roomId: string) => {
            if (roomId === 'ROOM#VORTEX') {
                return {
                    EphemeraId: roomId,
                    DataCategory: 'Meta::Room',
                    objects: [{ uuid: 'OBJECT#anvil' as `OBJECT#${string}`, shortName: 'anvil', stableKey: 'anvil' }],
                }
            }
            return {
                EphemeraId: roomId,
                DataCategory: 'Meta::Room',
                objects: [],
            }
        })
        getIntentRecord.mockResolvedValue({
            intent: 'Hypothesis: It looks like you are trying to drop the anvil.',
        })
        invokeBedrockHypothesisMock.mockResolvedValue({
            success: true,
            body: 'Outcome: The anvil drops on your own foot while the Road Runner speeds past, unbothered.',
        })
    })

    it('returns RenderTree from model output when Bedrock succeeds', async () => {
        await expect(
            generatePlanOutcome({ getGameRooms, getRoomMeta, getIntentRecord })
        ).resolves.toEqual([
            'Outcome: The anvil drops on your own foot while the Road Runner speeds past, unbothered.',
        ])
    })

    it('loads staged objects, hypothesis, and passes prompt to Bedrock', async () => {
        await generatePlanOutcome({ getGameRooms, getRoomMeta, getIntentRecord })

        expect(getGameRooms).toHaveBeenCalledTimes(1)
        expect(getIntentRecord).toHaveBeenCalledTimes(1)
        expect(getRoomMeta).toHaveBeenCalledTimes(2)
        expect(invokeBedrockHypothesisMock).toHaveBeenCalledTimes(1)
        const promptArg = invokeBedrockHypothesisMock.mock.calls[0][0] as {
            invariantPrefix: string
            dynamicSuffix: string
        }
        const fullPrompt = promptArg.invariantPrefix + promptArg.dynamicSuffix
        expect(fullPrompt).toContain('CLIFFBASE')
        expect(fullPrompt).toContain('anvil')
        expect(fullPrompt).toContain('Hypothesis: It looks like you are trying to drop the anvil.')
        expect(invokeBedrockHypothesisMock.mock.calls[0][1]).toEqual({ maxTokens: 384 })
    })

    it('uses both overrides without consulting room meta or getIntentRecord deps', async () => {
        await generatePlanOutcome({
            getGameRooms,
            getRoomMeta,
            getIntentRecord,
            roomObjectsByRoomOverride: {
                'ROOM#VORTEX': harnessRoomObjects('vortex', ['catapult']),
                'ROOM#CLIFFTOP': harnessRoomObjects('clifftop', ['lever']),
            },
            hypothesisLineOverride: 'Hypothesis: It looks like you are trying to spring a cliff trap.',
        })

        expect(getGameRooms).not.toHaveBeenCalled()
        expect(getRoomMeta).not.toHaveBeenCalled()
        expect(getIntentRecord).not.toHaveBeenCalled()
        const promptArg = invokeBedrockHypothesisMock.mock.calls[0][0] as {
            invariantPrefix: string
            dynamicSuffix: string
        }
        const fullPrompt = promptArg.invariantPrefix + promptArg.dynamicSuffix
        expect(fullPrompt).toContain('CLIFFBASE')
        expect(fullPrompt).toContain('catapult')
        expect(fullPrompt).toContain('CLIFFTOP')
        expect(fullPrompt).toContain('lever')
        expect(fullPrompt).toContain('Hypothesis: It looks like you are trying to spring a cliff trap.')
    })

    it('does not call getIntentRecord when intentRecordOverride supplies walkthrough and narrativeBeatsStructured', async () => {
        await generatePlanOutcome({
            getGameRooms,
            getRoomMeta,
            getIntentRecord,
            roomObjectsByRoomOverride: {
                'ROOM#VORTEX': harnessRoomObjects('vortex', ['catapult']),
            },
            intentRecordOverride: {
                intent: 'Hypothesis: Full record override.',
                walkthrough: 'Scene beats align to the plan.',
                narrativeBeatsStructured: {
                    beats: [
                        {
                            beatId: 'prep',
                            description: 'Prime the catapult and commit timing.',
                            derivedFrom: ['catapult'],
                        },
                    ],
                    linearizedSequence: ['prep'],
                },
            },
        })

        expect(getGameRooms).not.toHaveBeenCalled()
        expect(getRoomMeta).not.toHaveBeenCalled()
        expect(getIntentRecord).not.toHaveBeenCalled()
        const promptArg = invokeBedrockHypothesisMock.mock.calls[0][0] as {
            invariantPrefix: string
            dynamicSuffix: string
        }
        const fullPrompt = promptArg.invariantPrefix + promptArg.dynamicSuffix
        expect(fullPrompt).toContain('Hypothesis: Full record override.')
        expect(fullPrompt).toContain('## Scene analysis')
        expect(fullPrompt).toContain('Scene beats align to the plan.')
        expect(fullPrompt).toContain('## Narrative beats structured (execution outline)')
        expect(fullPrompt).toContain('Prime the catapult and commit timing.')
        expect(fullPrompt).toContain('catapult')
    })

    it('still calls getIntentRecord when only room object override is provided', async () => {
        await generatePlanOutcome({
            getGameRooms,
            getRoomMeta,
            getIntentRecord,
            roomObjectsByRoomOverride: {
                'ROOM#BRIDGE': harnessRoomObjects('bridge', ['portable hole']),
            },
        })

        expect(getGameRooms).not.toHaveBeenCalled()
        expect(getRoomMeta).not.toHaveBeenCalled()
        expect(getIntentRecord).toHaveBeenCalledTimes(1)
    })

    it('still loads room meta when only hypothesis override is provided', async () => {
        await generatePlanOutcome({
            getGameRooms,
            getRoomMeta,
            getIntentRecord,
            hypothesisLineOverride: 'Hypothesis: It looks like you are trying to launch a boulder.',
        })

        expect(getGameRooms).toHaveBeenCalledTimes(1)
        expect(getRoomMeta).toHaveBeenCalledTimes(2)
        expect(getIntentRecord).not.toHaveBeenCalled()
    })

    it('renders narrative-beats/walkthrough context without relying on legacy role labels', async () => {
        await generatePlanOutcome({
            getGameRooms,
            getRoomMeta,
            getIntentRecord,
            roomObjectsByRoomOverride: {
                'ROOM#VORTEX': [
                    {
                        uuid: 'OBJECT#anvil' as `OBJECT#${string}`,
                        shortName: 'anvil',
                        stableKey: 'anvil',
                        tropeAffinities: [
                            { trope: 'Finishing Move', aptness: 'High', narrowing: 'terminal drop payload' },
                        ],
                    },
                ],
            },
            intentRecordOverride: {
                intent: 'Hypothesis: Trope-first only.',
                walkthrough: 'Contraption setup transitions into final drop beat.',
                narrativeBeatsStructured: {
                    beats: [
                        {
                            beatId: 'prep',
                            description: 'Set up launch lane.',
                            derivedFrom: ['anvil'],
                        },
                        {
                            beatId: 'finish',
                            description: 'Trigger final drop.',
                            derivedFrom: ['anvil'],
                        },
                    ],
                    linearizedSequence: ['prep', 'finish'],
                },
            },
        })

        const promptArg = invokeBedrockHypothesisMock.mock.calls[0][0] as {
            invariantPrefix: string
            dynamicSuffix: string
        }
        const fullPrompt = promptArg.invariantPrefix + promptArg.dynamicSuffix
        expect(fullPrompt).toContain('Linearized sequence: prep -> finish')
        expect(fullPrompt).toContain('Contraption setup transitions into final drop beat.')
        expect(fullPrompt).not.toContain('coyote-equipment')
    })

    it('falls back to stub when Bedrock fails', async () => {
        invokeBedrockHypothesisMock.mockResolvedValue({
            success: false,
            errorMessage: 'Throttled',
        })

        await expect(generatePlanOutcome({ getGameRooms, getRoomMeta, getIntentRecord })).resolves.toEqual([
            'Outcome: Stubbed',
        ])
    })

    it('falls back to stub when body does not start with Outcome:', async () => {
        invokeBedrockHypothesisMock.mockResolvedValue({
            success: true,
            body: 'The trap fails.',
        })

        await expect(generatePlanOutcome({ getGameRooms, getRoomMeta, getIntentRecord })).resolves.toEqual([
            'Outcome: Stubbed',
        ])
    })
})
