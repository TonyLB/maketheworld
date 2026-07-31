import { orchestrateCharacterDisconnect } from './orchestrateCharacterDisconnect'
import { moveLeaveSlotId } from '../manipulation/kernel/compile/moveBundleSlotIds'

describe('orchestrateCharacterDisconnect', () => {
    const messageBus = { publish: jest.fn() }

    beforeEach(() => {
        jest.clearAllMocks()
    })

    const bundleDeclares = () => (
        messageBus.publish.mock.calls
            .map((call) => call[0])
            .filter((message) => message?.type === 'StreamingEvent' && message?.header?.type === 'Message Bundle Declared')
    )

    const slotReports = () => (
        messageBus.publish.mock.calls
            .map((call) => call[0])
            .filter((message) => message?.type === 'StreamingEvent' && message?.header?.type === 'Message Slot Reported')
    )

    it('declares the bundle and reports a narrate-leave slot with "has disconnected" wording, audience from the capture', async () => {
        await orchestrateCharacterDisconnect({
            characterId: 'CHARACTER#Test',
            characterName: 'Tess',
            froms: ['ROOM#alpha'],
            bundleId: 'BUNDLE#test',
            captures: new Map([
                ['capture:from:ROOM#alpha', ['CHARACTER#Test', 'CHARACTER#Other']],
            ]) as any,
            messageBus: messageBus as any,
        })

        expect(bundleDeclares()).toHaveLength(1)
        await expect(bundleDeclares()[0].getContent()).resolves.toEqual({
            bundleId: 'BUNDLE#test',
            slots: [{ slotId: moveLeaveSlotId('ROOM#alpha' as any), expectedPublishType: 'WorldMessage' }],
        })

        const reports = slotReports()
        expect(reports).toHaveLength(1)
        const reportContent = await reports[0].getContent()
        expect(reportContent.slotId).toEqual(moveLeaveSlotId('ROOM#alpha' as any))
        expect(reportContent.message.targets).toEqual(['CHARACTER#Test', 'CHARACTER#Other'])
        expect(reportContent.message.message).toEqual(['Tess has disconnected.'])
    })

    it('is a no-op when froms is empty', async () => {
        await orchestrateCharacterDisconnect({
            characterId: 'CHARACTER#Test',
            characterName: 'Tess',
            froms: [],
            bundleId: 'BUNDLE#test',
            captures: new Map() as any,
            messageBus: messageBus as any,
        })

        expect(messageBus.publish).not.toHaveBeenCalled()
    })

    it('throws if the capture for a from-room is missing (internal-consistency guard, mirrors presentStepSequence)', async () => {
        await expect(orchestrateCharacterDisconnect({
            characterId: 'CHARACTER#Test',
            characterName: 'Tess',
            froms: ['ROOM#alpha'],
            bundleId: 'BUNDLE#test',
            captures: new Map() as any,
            messageBus: messageBus as any,
        })).rejects.toThrow(/references captureId/)
    })
})
