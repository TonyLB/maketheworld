import type { LookCommandRequestedPublishedPayload } from '../actions/publishedEvents'
import { prepareFullRoomDescriptionRenderForCharacter } from '../actions/requestFullRoomDescriptionForCharacter'
import type { MessageBus } from '../../messageBus/baseClasses'
import { sendPerceptionThreadRegistered } from '../perception/subscribedEvents'
import { sendRenderRequested } from './subscribedEvents'
import internalCache from '../../internalCache'
import type { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { v4 as uuidv4 } from 'uuid'

export async function provisionalGenerationContextWmlFromRoomShortName(
    roomId: EphemeraRoomId,
    assetStack: string[],
): Promise<string> {
    const generationContext = await internalCache.GenerationContext.get(
        roomId as ComponentUUID,
        assetStack as AssetUUID[],
    )
    const provisionalForm = new StandardForm([
        { tag: 'Asset', universalKey: 'ASSET#generationContext', key: 'generationContext' },
        {
            tag: 'Room',
            universalKey: roomId,
            ...(generationContext ? { shortName: generationContext.shortName.toJSON() } : {}),
        },
    ])
    return schemaToWML([provisionalForm.schema])
}

/**
 * Event-driven look: register `roomDescription` on a run-scoped bus lane, flush so `PerceptionThreads` exists, then
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
    // Provisional boundary adaptation while broader generation-context migration remains in flight:
    // taskPlanning/lambda/ephemera/internalCache/generationContext/AGENT.generationContextCache.planning.md
    const provisionalGenerationContextWml = await provisionalGenerationContextWmlFromRoomShortName(
        prepared.roomId,
        prepared.renderCommand.perspective.assetStack,
    )
    const perceptionLane = `lookCommand:perceptionThread:${uuidv4()}`
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
