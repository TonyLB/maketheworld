import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { StateChangeCommand } from '../localApiEvents'
import { mergePersistMetaRoomMarks } from './mergePersistMetaRoomMarks'
import type { StateChangedPayload } from './events'
import messageBus from '../../messageBus'

/**
 * Apply api.ephemera `State Change` to Dynamo: rooms merge `markState` into `Meta::Room.state.marks`.
 * Non-room component ids: no-op for internal callers; correlated `requestId` receives an Error `ReturnValue`.
 *
 * Default marks (when none stored) use `computeDefaultMarksForRoom`, which resolves the Canon asset stack via
 * `resolveCanonAssetStackForRoom` only in that path.
 */
export const handleApiStateChangeCommand = async (
    cmd: StateChangeCommand,
    deps: {
        streamEvent: StreamEventFunction<StateChangedPayload, StreamingEventHeader>;
    }
): Promise<void> => {
    const rid = cmd.requestId

    const sendError = (message: string) => {
        if (!rid) {
            return
        }
        messageBus.publish({
            type: 'ReturnValue',
            body: {
                messageType: 'Error',
                RequestId: rid,
                message,
            },
        })
    }

    const sendSuccess = () => {
        if (!rid) {
            return
        }
        messageBus.publish({
            type: 'ReturnValue',
            body: {
                messageType: 'EphemeraCommandSuccess',
                RequestId: rid,
                command: 'stateChange' as const,
                componentId: cmd.componentId,
            },
        })
    }

    if (!isEphemeraRoomId(cmd.componentId)) {
        sendError('STATE_CHANGE_INVALID_COMPONENT: componentId must be a room id')
        return
    }

    const result = await mergePersistMetaRoomMarks({
        roomId: cmd.componentId,
        incomingMarks: cmd.markState,
    })

    if (!result.ok) {
        console.error(`[mtw.ephemera.state] mergePersistMetaRoomMarks failed: ${result.errorMessage}`)
        sendError(`STATE_CHANGE_FAILED: ${result.errorMessage}`)
        return
    }

    if (result.persisted) {
        await deps.streamEvent({
            streamKey: cmd.componentId,
            header: { type: 'State Changed' },
            update: {
                type: 'State Changed',
                componentId: cmd.componentId,
                incomingMarkState: cmd.markState,
                priorState: result.priorState,
                newState: result.newState,
            },
        })
    }
    // ok && !persisted: merge was a no-op (e.g. identical marks); still ack success for correlated clients.
    sendSuccess()
}
