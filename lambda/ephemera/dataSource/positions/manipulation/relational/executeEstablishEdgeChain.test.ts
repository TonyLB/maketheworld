import { executeEstablishEdgeChain } from './executeObjectEstablishRelation'
import * as kernel from '../kernel/commitStepSequence'
import type { MutationKernelStep } from '../kernel/kernelStep'

jest.mock('../kernel/commitStepSequence', () => ({
    commitStepSequence: jest.fn(),
}))

const commitStepSequenceMock = kernel.commitStepSequence as jest.MockedFunction<typeof kernel.commitStepSequence>

describe('executeEstablishEdgeChain', () => {
    beforeEach(() => {
        commitStepSequenceMock.mockReset()
    })

    const messageBus = { publish: jest.fn() }
    const streamEvent = jest.fn()

    it("commits PV1-0's own readout chain (one addCrossingPort, two establishRelation legs) unmerged and in order", async () => {
        commitStepSequenceMock.mockResolvedValue({
            ok: true,
            beatAnchorTime: 12345,
            steps: [],
            captures: new Map(),
        })

        const port = { kind: 'Crossing', portId: 'PORT#1', fromHostId: 'ROOM#Vortex' } as any
        const steps: MutationKernelStep[] = [
            { kind: 'addCrossingPort', hostId: 'OBJECT#Table', port },
            {
                kind: 'establishRelation',
                subjectId: { owner: 'OBJECT#Table', port: 'PORT#1' },
                targetId: 'OBJECT#Cup',
                hostId: 'OBJECT#Table',
                relationKind: 'Custom',
                relationLabel: 'tie',
            },
            {
                kind: 'establishRelation',
                subjectId: 'OBJECT#String',
                targetId: { owner: 'OBJECT#Table', port: 'PORT#1' },
                hostId: 'ROOM#Vortex',
                relationKind: 'Custom',
                relationLabel: 'tie',
            },
        ]

        const result = await executeEstablishEdgeChain({ steps, messageBus: messageBus as any, streamEvent: streamEvent as any })

        expect(result).toEqual({ ok: true, beatAnchorTime: 12345, captures: new Map() })
        expect(commitStepSequenceMock).toHaveBeenCalledTimes(1)
        const [passedArgs, deps] = commitStepSequenceMock.mock.calls[0]
        expect(passedArgs.steps).toEqual(steps)
        // Port-address endpoints are never resolved through getCurrentHost --- only the primitive
        // endpoints of each establishRelation/dissolveRelation step are, keyed by that step's own hostId.
        expect(deps.getCurrentHost('OBJECT#Cup' as any)).toEqual('OBJECT#Table')
        expect(deps.getCurrentHost('OBJECT#String' as any)).toEqual('ROOM#Vortex')
        expect(deps.getCurrentHost('OBJECT#Unrelated' as any)).toBeUndefined()
    })

    it('commits a degenerate portless single-relation chain', async () => {
        commitStepSequenceMock.mockResolvedValue({
            ok: true,
            beatAnchorTime: 999,
            steps: [],
            captures: new Map(),
        })

        const steps: MutationKernelStep[] = [
            {
                kind: 'establishRelation',
                subjectId: 'OBJECT#Rope',
                targetId: 'OBJECT#Hook',
                hostId: 'ROOM#Vortex',
                relationKind: 'Custom',
                relationLabel: 'tie',
            },
        ]

        const result = await executeEstablishEdgeChain({ steps, messageBus: messageBus as any, streamEvent: streamEvent as any })

        expect(result.ok).toBe(true)
        const [, deps] = commitStepSequenceMock.mock.calls[0]
        expect(deps.getCurrentHost('OBJECT#Rope' as any)).toEqual('ROOM#Vortex')
        expect(deps.getCurrentHost('OBJECT#Hook' as any)).toEqual('ROOM#Vortex')
    })

    it('propagates a commit failure rather than swallowing it', async () => {
        commitStepSequenceMock.mockResolvedValue({
            ok: false,
            errorCode: 'STEP_SEQUENCE_TRANSACT_FAILED',
            errorMessage: 'boom',
        })
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

        const steps: MutationKernelStep[] = [
            {
                kind: 'establishRelation',
                subjectId: 'OBJECT#Rope',
                targetId: 'OBJECT#Hook',
                hostId: 'ROOM#Vortex',
                relationKind: 'Custom',
                relationLabel: 'tie',
            },
        ]

        const result = await executeEstablishEdgeChain({ steps, messageBus: messageBus as any, streamEvent: streamEvent as any })

        expect(result).toEqual({ ok: false, errorCode: 'STEP_SEQUENCE_TRANSACT_FAILED', errorMessage: 'boom' })
        expect(consoleErrorSpy).toHaveBeenCalled()
        consoleErrorSpy.mockRestore()
    })

    it('filters out a stray transferMembership step rather than throwing', async () => {
        commitStepSequenceMock.mockResolvedValue({
            ok: true,
            beatAnchorTime: 1,
            steps: [],
            captures: new Map(),
        })

        const steps: MutationKernelStep[] = [
            {
                kind: 'transferMembership',
                entityIds: new Set(['OBJECT#Rope' as any]),
                fromHostIds: new Set(['ROOM#Vortex' as any]),
                toHostId: 'ROOM#Vortex' as any,
            },
            {
                kind: 'establishRelation',
                subjectId: 'OBJECT#Rope',
                targetId: 'OBJECT#Hook',
                hostId: 'ROOM#Vortex',
                relationKind: 'Custom',
                relationLabel: 'tie',
            },
        ]

        const result = await executeEstablishEdgeChain({ steps, messageBus: messageBus as any, streamEvent: streamEvent as any })

        expect(result.ok).toBe(true)
        const [passedArgs] = commitStepSequenceMock.mock.calls[0]
        expect(passedArgs.steps).toEqual([steps[1]])
    })
})
