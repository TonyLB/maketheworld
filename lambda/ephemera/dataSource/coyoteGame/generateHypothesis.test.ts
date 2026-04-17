jest.mock('./invokeBedrockHypothesis', () => {
    const actual = jest.requireActual('./invokeBedrockHypothesis')
    return {
        ...actual,
        invokeBedrockHypothesisStageOne: jest.fn(),
        invokeBedrockHypothesisStageTwo: jest.fn(),
    }
})

import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { generateHypothesis } from './generateHypothesis'
import {
    invokeBedrockHypothesisStageOne,
    invokeBedrockHypothesisStageTwo,
} from './invokeBedrockHypothesis'

/** Matches default getRoomMeta mock (VORTEX: anvil, rocket skates). */
const stageOneSeamBody = `## Objects

### ROOM#VORTEX · anvil
- **Function:** Heavy weight overhead.
- **Affinity:** coyoteOperated

### ROOM#VORTEX · rocket skates
- **Function:** Build chase speed on the highway.
- **Affinity:** coyoteOperated

## Clusters

### Combined setup
- **Members:** ROOM#VORTEX · anvil; ROOM#VORTEX · rocket skates
- **Coyote role:** participant
- **Summary:** Weight plus speed props at the cliff base highway.
`

const stageOneMock = invokeBedrockHypothesisStageOne as jest.MockedFunction<
    typeof invokeBedrockHypothesisStageOne
>
const stageTwoMock = invokeBedrockHypothesisStageTwo as jest.MockedFunction<
    typeof invokeBedrockHypothesisStageTwo
>

describe('generateHypothesis', () => {
    const getGameRooms = jest.fn<Promise<string[]>, []>()
    const getRoomMeta = jest.fn()

    beforeEach(() => {
        jest.clearAllMocks()
        getGameRooms.mockResolvedValue(['VORTEX', 'STRAIGHTAWAY'])
        getRoomMeta.mockImplementation(async (roomId: string) => {
            if (roomId === 'ROOM#VORTEX') {
                return {
                    EphemeraId: roomId,
                    DataCategory: 'Meta::Room',
                    objects: [
                        { uuid: 'OBJECT#anvil', shortName: 'anvil' },
                        { uuid: 'OBJECT#rocket-skates', shortName: 'rocket skates' },
                    ],
                }
            }
            return {
                EphemeraId: roomId,
                DataCategory: 'Meta::Room',
                objects: [],
            }
        })
        stageOneMock.mockResolvedValue({
            success: true,
            body: stageOneSeamBody,
            usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
        })
        stageTwoMock.mockResolvedValue({
            success: true,
            body: 'Hypothesis: You are trying to drop something on the Road Runner.',
            usage: { inputTokens: 4, outputTokens: 5, totalTokens: 9 },
        })
    })

    it('returns stage-2 model output when both stages succeed', async () => {
        await expect(generateHypothesis({ getGameRooms, getRoomMeta })).resolves.toEqual({
            intent: 'Hypothesis: You are trying to drop something on the Road Runner.',
        })
        expect(stageOneMock).toHaveBeenCalledTimes(1)
        expect(stageTwoMock).toHaveBeenCalledTimes(1)
    })

    it('fetches room-local objects for all Coyote Game rooms when not overridden', async () => {
        await generateHypothesis({ getGameRooms, getRoomMeta })

        expect(getGameRooms).toHaveBeenCalledTimes(1)
        expect(getRoomMeta).toHaveBeenCalledTimes(2)
        expect(getRoomMeta).toHaveBeenNthCalledWith(1, 'ROOM#VORTEX')
        expect(getRoomMeta).toHaveBeenNthCalledWith(2, 'ROOM#STRAIGHTAWAY')
    })

    it('uses room object override without consulting room meta deps', async () => {
        const overrideSeam = `## Objects

### ROOM#VORTEX · anvil
- **Function:** Drop weight.
- **Affinity:** coyoteOperated

### ROOM#BRIDGE · portable hole
- **Function:** Chasm trap.
- **Affinity:** roadRunnerTrap

### ROOM#BRIDGE · birdseed
- **Function:** Bait.
- **Affinity:** ambiguous

## Clusters

### Multi-room
- **Members:** ROOM#VORTEX · anvil; ROOM#BRIDGE · portable hole; ROOM#BRIDGE · birdseed
- **Coyote role:** trapSetter
- **Summary:** Staged across base and bridge.
`
        stageOneMock.mockResolvedValue({ success: true, body: overrideSeam })

        await generateHypothesis({
            getGameRooms,
            getRoomMeta,
            roomObjectsByRoomOverride: {
                'ROOM#VORTEX': ['anvil'],
                'ROOM#BRIDGE': ['portable hole', 'birdseed'],
            },
        })

        expect(getGameRooms).not.toHaveBeenCalled()
        expect(getRoomMeta).not.toHaveBeenCalled()
        expect(stageOneMock).toHaveBeenCalledTimes(1)
        expect(stageTwoMock).toHaveBeenCalledTimes(1)
        const stageTwoPrompt = stageTwoMock.mock.calls[0][0] as {
            invariantPrefix: string
            dynamicSuffix: string
        }
        const fullStageTwo = stageTwoPrompt.invariantPrefix + stageTwoPrompt.dynamicSuffix
        expect(fullStageTwo).toContain('VORTEX: anvil')
        expect(fullStageTwo).toContain('BRIDGE: portable hole, birdseed')
    })

    it('falls back to stub when stage 1 Bedrock fails', async () => {
        stageOneMock.mockResolvedValue({
            success: false,
            errorMessage: 'Throttled',
        })

        await expect(generateHypothesis({ getGameRooms, getRoomMeta })).resolves.toEqual({
            intent: 'Hypothesis: Stubbed',
        })
        expect(stageTwoMock).not.toHaveBeenCalled()
    })

    it('falls back to stub when stage 1 seam parse fails', async () => {
        stageOneMock.mockResolvedValue({
            success: true,
            body: 'not valid seam markdown',
        })

        await expect(generateHypothesis({ getGameRooms, getRoomMeta })).resolves.toEqual({
            intent: 'Hypothesis: Stubbed',
        })
        expect(stageTwoMock).not.toHaveBeenCalled()
    })

    it('falls back to stub when stage 2 Bedrock fails', async () => {
        stageTwoMock.mockResolvedValue({
            success: false,
            errorMessage: 'Timeout',
        })

        await expect(generateHypothesis({ getGameRooms, getRoomMeta })).resolves.toEqual({
            intent: 'Hypothesis: Stubbed',
        })
        expect(stageTwoMock).toHaveBeenCalledTimes(1)
    })
})
