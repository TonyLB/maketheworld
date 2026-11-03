import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { RenderTree } from '@tonylb/mtw-base/ts/renderTree'
import type { MessageBus } from '../../../messageBus/baseClasses'
import { COYOTE_RENDER_LINE_BREAK } from '../../coyoteGame/utilities/coyoteRenderTree'
import type { ActorLudicCache } from '../../positions/ludicCache/actorCache'
import { renderScene, type SceneFormat } from '../sceneProse'

export type RunSceneTestHarnessDeps = {
    characterId: EphemeraCharacterId
    messageBus: Pick<MessageBus, 'publish'>
    /** The actor's cache as the command world built it; absent for a character in no room. */
    actorCache?: Pick<ActorLudicCache, 'scene'>
    /** The render format; absent: D. */
    format?: SceneFormat
}

/**
 * Publishes **one** OOC message with the scene of the actor's own cache as an LLM reader is shown it (format D unless
 * another is named), then the handle table (handle -> id), which a reader never sees. Exits are not read: the topology
 * yields room ids, not names, and an id must not reach the reader. No Bedrock call.
 */
export function runSceneTestHarness({ characterId, messageBus, actorCache, format = 'D' }: RunSceneTestHarnessDeps): void {
    const tree: RenderTree = [`Scene harness, format ${format} (the actor's cache as a reader sees it)`, COYOTE_RENDER_LINE_BREAK]
    if (!actorCache) {
        tree.push('(no scene: you are not in a room)', COYOTE_RENDER_LINE_BREAK)
    }
    else {
        const { scene, handles } = actorCache.scene()
        tree.push(...renderScene(scene, format).split('\n').flatMap((line) => [line, COYOTE_RENDER_LINE_BREAK]))
        tree.push('Handles (never shown to the reader):', COYOTE_RENDER_LINE_BREAK)
        tree.push(...(handles.length === 0 ? ['(none)'] : handles.map(({ handle, id }) => `- [${handle}] -> ${id}`))
            .flatMap((line) => [line, COYOTE_RENDER_LINE_BREAK]))
    }
    messageBus.publish({
        type: 'PublishMessage',
        targets: [characterId],
        displayProtocol: 'WorldOOCMessage',
        message: tree,
    })
}
