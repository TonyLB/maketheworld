import type { LookCommandRequestedPublishedPayload } from '../actions/publishedEvents'
import { prepareFullRoomDescriptionRenderForCharacter } from '../actions/requestFullRoomDescriptionForCharacter'
import type { MessageBus } from '../../messageBus/baseClasses'
import { sendPerceptionThreadRegistered } from '../perception/subscribedEvents'
import { lookCommandPerceptionThreadLaneId, sendRenderRequested } from './subscribedEvents'
import internalCache from '../../internalCache'
import { mergeRoomShortNameLiteral } from '../../internalCache/componentStackMerge'
import type { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

export async function provisionalGenerationContextWmlFromRoomShortName(
    roomId: EphemeraRoomId,
    assetStack: string[],
): Promise<string> {
    const roomMetaByAsset = await internalCache.ComponentAssetMeta.getAcrossAssets(
        roomId as ComponentUUID,
        assetStack as AssetUUID[],
    )
    const mergedShortName = mergeRoomShortNameLiteral(
        Object.values(roomMetaByAsset).flatMap((component) => (
            component instanceof StandardRoom ? [component] : []
        ))
    )
    const provisionalForm = new StandardForm([
        { tag: 'Asset', universalKey: 'ASSET#generationContext', key: 'generationContext' },
        {
            tag: 'Room',
            universalKey: roomId,
            ...(mergedShortName ? { shortName: mergedShortName.toJSON() } : {}),
        },
    ])
    return schemaToWML([provisionalForm.schema])
}

/**
 * Event-driven look: register `roomDescription` on a named bus lane, flush so `PerceptionThreads` exists, then
 * `Render Requested` on the default lane (ongoing `flush` resolves it; no `renderOrchestration:*` lane for this path).
 */
export async function handleLookCommandRequestedForRenderOrchestration(
    messageBus: MessageBus,
    payload: LookCommandRequestedPublishedPayload,
): Promise<void> {
    const prepared = await prepareFullRoomDescriptionRenderForCharacter(
        payload.characterId,
        payload.roomId,
        { includeGenerationContextWml: false },
    )
    // Provisional ad-hoc context until structured internal cache lands:
    // taskPlanning/lambda/ephemera/internalCache/generationContext/AGENT.generationContextCache.planning.md
    const provisionalGenerationContextWml = await provisionalGenerationContextWmlFromRoomShortName(
        prepared.roomId,
        prepared.renderCommand.perspective.assetStack,
    )
    const perceptionLane = lookCommandPerceptionThreadLaneId({
        roomId: prepared.roomId,
        characterId: prepared.characterId,
    })
    sendPerceptionThreadRegistered(
        messageBus,
        prepared.roomId,
        prepared.threadRegisterCommand,
        perceptionLane
    )
    await messageBus.flush(perceptionLane)
    sendRenderRequested(
        messageBus,
        prepared.roomId,
        {
            ...prepared.renderCommand,
            generationContextWml: provisionalGenerationContextWml,
        },
        { useDefaultMessageBusLane: true }
    )
}
