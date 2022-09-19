import { v4 as uuidv4 } from 'uuid'
import { isCharacterMessage, isWorldMessage, PublishMessage, MessageBus } from "../messageBus/baseClasses"
import { publishMessage as publishMessageDynamoDB } from "@tonylb/mtw-utilities/dist/dynamoDB"
import { splitType } from '@tonylb/mtw-utilities/dist/types'
import { unique } from '@tonylb/mtw-utilities/dist/lists'
import internalCache from '../internalCache'

const remapTargets = async (targets: string[]): Promise<string[]> => {
    const roomTargets = targets.filter((target) => (splitType(target)[0] === 'ROOM'))
    const nonRoomTargets = targets.filter((target) => (splitType(target)[0] !== 'ROOM'))
    const mappedRoomTargetGroups = (await Promise.all(roomTargets
            .map((target) => (internalCache.RoomCharacterList.get(splitType(target)[1])))
        ))
        .map((activeCharacters) => ((activeCharacters || []).map(({ EphemeraId }) => (EphemeraId))))
    return unique(nonRoomTargets, ...mappedRoomTargetGroups) as string[]
}

export const publishMessage = async ({ payloads }: { payloads: PublishMessage[], messageBus?: MessageBus }): Promise<void> => {
    const CreatedTime = Date.now()
    await Promise.all(payloads.map(async (payload, index) => {
        if (isWorldMessage(payload)) {
            //
            // TODO: Fold the entirety of the messaging functionality in here, rather than have it hang off of
            // DynamoDB events (with all the associated latency and possible runaway error loops)
            //
            const remappedTargets = await remapTargets(payload.targets)
            await publishMessageDynamoDB({
                MessageId: `MESSAGE#${uuidv4()}`,
                CreatedTime: CreatedTime + index,
                Targets: remappedTargets,
                Message: payload.message,
                DisplayProtocol: payload.displayProtocol,
            })
        }
        if (isCharacterMessage(payload)) {
            const remappedTargets = await remapTargets(payload.targets)
            await publishMessageDynamoDB({
                MessageId: `MESSAGE#${uuidv4()}`,
                CreatedTime: CreatedTime + index,
                Targets: remappedTargets,
                Message: payload.message,
                DisplayProtocol: payload.displayProtocol,
                Name: payload.name,
                CharacterId: payload.characterId,
                Color: payload.color
            })
        }
    }))
}

export default publishMessage
