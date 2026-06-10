/**
 * Send Leave / Arrive WorldMessage legs for a registered characterMove perception thread.
 * Looks up row by (arrival room componentId, perspectiveKey, registrationId).
 */
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../../internalCache'
import type { MessageBus } from '../../messageBus/baseClasses'

export type CharacterMoveDeliveryKey = {
    componentId: EphemeraRoomId;
    perspectiveKey: string;
    registrationId: string;
}

export function sendCharacterMoveLeave(messageBus: MessageBus, key: CharacterMoveDeliveryKey): void {
    const entries = internalCache.PerceptionThreads.list(key.componentId, key.perspectiveKey)
    const entry = entries.find(
        (e) => e.registrationId === key.registrationId && e.registration.threadKind === 'characterMove'
    )
    if (!entry || entry.registration.threadKind !== 'characterMove') {
        return
    }
    const leave = entry.registration.leaveWorldMessage
    if (!leave) {
        return
    }
    messageBus.publish({
        type: 'PublishMessage',
        displayProtocol: 'WorldMessage',
        targets: leave.targets,
        message: leave.message,
        messageGroupId: entry.registration.leaveMessageGroupId,
        deliveryMode: 'deferred',
    })
}

export function sendCharacterMoveArrive(messageBus: MessageBus, key: CharacterMoveDeliveryKey): void {
    const entries = internalCache.PerceptionThreads.list(key.componentId, key.perspectiveKey)
    const entry = entries.find(
        (e) => e.registrationId === key.registrationId && e.registration.threadKind === 'characterMove'
    )
    if (!entry || entry.registration.threadKind !== 'characterMove') {
        return
    }
    const arrive = entry.registration.arriveWorldMessage
    if (!arrive) {
        return
    }
    messageBus.publish({
        type: 'PublishMessage',
        displayProtocol: 'WorldMessage',
        targets: arrive.targets,
        message: arrive.message,
        messageGroupId: entry.registration.arriveMessageGroupId,
        deliveryMode: 'deferred',
    })
}
