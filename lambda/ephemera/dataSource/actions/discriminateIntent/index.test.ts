import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { discriminateIntent } from './index'
import { navigationIntentErrorMessages } from './exitResolution'

describe('discriminateIntent', () => {
    const northRoom = 'ROOM#north' as EphemeraRoomId
    const southRoom = 'ROOM#south' as EphemeraRoomId

    it('returns deterministic result without invoking Bedrock', async () => {
        const invokeBedrockParseCommandImpl = jest.fn()
        const result = await discriminateIntent(
            { command: 'look' },
            { invokeBedrockParseCommandImpl }
        )

        expect(result).toEqual({ type: 'LookRoom', confidence: 1 })
        expect(invokeBedrockParseCommandImpl).not.toHaveBeenCalled()
    })

    it('returns deterministic ObjectMembershipIntent for take without invoking Bedrock', async () => {
        const invokeBedrockParseCommandImpl = jest.fn()
        const result = await discriminateIntent(
            { command: 'take broom', roomObjectLabels: ['broom'] },
            { invokeBedrockParseCommandImpl }
        )

        expect(result).toEqual({
            type: 'ObjectMembershipIntent',
            rawObjectSpans: ['broom'],
            verbClass: 'acquire',
            confidence: 1,
        })
        expect(invokeBedrockParseCommandImpl).not.toHaveBeenCalled()
    })

    it('returns Error when Bedrock invoke fails', async () => {
        const result = await discriminateIntent(
            { command: 'use teleporter' },
            {
                invokeBedrockParseCommandImpl: jest.fn().mockResolvedValue({
                    success: false,
                    errorMessage: 'Bedrock unavailable',
                }),
            }
        )

        expect(result).toEqual({ type: 'Error', errorMessage: 'Bedrock unavailable' })
    })

    it('passes through non-navigation intent-discrimination results', async () => {
        const result = await discriminateIntent(
            { command: 'use teleporter' },
            {
                invokeBedrockParseCommandImpl: jest.fn().mockResolvedValue({
                    success: true,
                    body: '{"type":"Unimplemented","confidence":0.7}',
                }),
            }
        )

        expect(result).toEqual({ type: 'Unimplemented', confidence: 0.7 })
    })

    it('passes through ObjectMembershipIntent without exit resolution', async () => {
        const result = await discriminateIntent(
            {
                command: 'pick up the broom',
                roomObjectLabels: ['broom'],
            },
            {
                invokeBedrockParseCommandImpl: jest.fn().mockResolvedValue({
                    success: true,
                    body: '{"type":"ObjectMembershipIntent","verbClass":"acquire","confidence":0.93}',
                }),
            }
        )

        expect(result).toEqual({
            type: 'ObjectMembershipIntent',
            rawObjectSpans: [],
            verbClass: 'acquire',
            confidence: 0.93,
        })
    })

    it('resolves NavigationIntent into Navigation when exit matches', async () => {
        const result = await discriminateIntent(
            {
                command: 'go somewhere',
                roomExits: [{ normalizedName: 'north', targetId: northRoom }],
            },
            {
                invokeBedrockParseCommandImpl: jest.fn().mockResolvedValue({
                    success: true,
                    body: '{"type":"NavigationIntent","exitCandidate":"north","confidence":0.88}',
                }),
            }
        )

        expect(result).toEqual({ type: 'Navigation', targetId: northRoom, exitName: 'north', confidence: 0.88 })
    })

    it('returns no-exit-context Error for NavigationIntent without exits', async () => {
        const result = await discriminateIntent(
            { command: 'go somewhere' },
            {
                invokeBedrockParseCommandImpl: jest.fn().mockResolvedValue({
                    success: true,
                    body: '{"type":"NavigationIntent","exitCandidate":"north","confidence":0.88}',
                }),
            }
        )

        expect(result).toEqual({ type: 'Error', errorMessage: navigationIntentErrorMessages.noExitContext })
    })

    it('returns no-match Error for NavigationIntent unknown exit', async () => {
        const result = await discriminateIntent(
            {
                command: 'go somewhere',
                roomExits: [{ normalizedName: 'north', targetId: northRoom }],
            },
            {
                invokeBedrockParseCommandImpl: jest.fn().mockResolvedValue({
                    success: true,
                    body: '{"type":"NavigationIntent","exitCandidate":"south","confidence":0.88}',
                }),
            }
        )

        expect(result).toEqual({ type: 'Error', errorMessage: navigationIntentErrorMessages.noMatch })
    })

    it('returns ambiguous-match Error for NavigationIntent with duplicate labels', async () => {
        const result = await discriminateIntent(
            {
                command: 'go somewhere',
                roomExits: [
                    { normalizedName: 'north', targetId: northRoom },
                    { normalizedName: 'north', targetId: southRoom },
                ],
            },
            {
                invokeBedrockParseCommandImpl: jest.fn().mockResolvedValue({
                    success: true,
                    body: '{"type":"NavigationIntent","exitCandidate":"north","confidence":0.88}',
                }),
            }
        )

        expect(result).toEqual({ type: 'Error', errorMessage: navigationIntentErrorMessages.ambiguousMatch })
    })

    it('resolves HomeIntent into Home terminal result', async () => {
        const result = await discriminateIntent(
            { command: 'go home' },
            {
                invokeBedrockParseCommandImpl: jest.fn().mockResolvedValue({
                    success: true,
                    body: '{"type":"HomeIntent","confidence":0.91}',
                }),
            }
        )

        expect(result).toEqual({ type: 'Home', confidence: 0.91 })
    })
})
