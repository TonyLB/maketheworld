import './index'
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import messageBus from '../../messageBus'
import { sendStateChange } from '../apiEphemera'
import { mergePersistMetaRoomMarks } from './mergePersistMetaRoomMarks'
import { EPHEMERA_STATE_DATA_SOURCE_KEY } from './events'
import { ephemeraStateDataSource } from './index'

jest.mock('./mergePersistMetaRoomMarks', () => ({
    mergePersistMetaRoomMarks: jest.fn(),
}))

const mergePersistMetaRoomMarksMock = mergePersistMetaRoomMarks as jest.MockedFunction<typeof mergePersistMetaRoomMarks>
const originalMessageBusPublish = messageBus.publish.bind(messageBus)

describe('mtw.ephemera.state DataSource', () => {
    beforeEach(() => {
        messageBus.clear()
        jest.clearAllMocks()
        mergePersistMetaRoomMarksMock.mockResolvedValue({ ok: true, persisted: false })
    })

    function spyPublish() {
        return jest.spyOn(messageBus, 'publish').mockImplementation((payload) => {
            originalMessageBusPublish(payload)
        })
    }

    it('publishes State Changed StreamingEvent after successful persist', async () => {
        const roomId = 'ROOM#r1' as EphemeraRoomId
        const priorState = { marks: { markValue: [] as { mark: string; value: string }[] } }
        const newState = { marks: { markValue: [{ mark: 'M', value: 'v' }] } }
        mergePersistMetaRoomMarksMock.mockResolvedValue({
            ok: true,
            persisted: true,
            priorState,
            newState,
        })
        const publishSpy = spyPublish()

        sendStateChange(messageBus, roomId, {
            componentId: roomId,
            markState: { markValue: [{ mark: 'M', value: 'v' }] },
        })
        await messageBus.flushAndSettle()

        expect(
            publishSpy.mock.calls.some(
                (call) =>
                    call[0]?.type === 'StreamingEvent'
                    && call[0]?.dataSourceKey === EPHEMERA_STATE_DATA_SOURCE_KEY
                    && call[0]?.header?.type === 'State Changed'
            )
        ).toBe(true)
        publishSpy.mockRestore()
    })
})
