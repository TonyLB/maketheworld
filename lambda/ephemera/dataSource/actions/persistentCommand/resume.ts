import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { CommandAttempt } from '../commandAttempt'
import type { RoomInPlayObjectCatalogEntry } from '../roomObjectCatalogForCharacter'
import { compileAttemptsFromSkeleton } from '../enrich/objectManipulation/compileAttemptsFromSkeleton'
import type {
    CompileAttemptsFromSkeletonDeps,
    CompileAttemptsFromSkeletonResult,
} from '../enrich/objectManipulation/compileAttemptsFromSkeleton'
import type { PersistentCommandPayload } from './payload'

/** The world inputs a resume reads fresh: a stored row deliberately holds none of them. */
export type PersistentCommandWorld = {
    characterId?: EphemeraCharacterId
    hostRoomId?: EphemeraRoomId
    roomObjectCatalog?: readonly RoomInPlayObjectCatalogEntry[]
    heldInventoryCatalog?: readonly RoomInPlayObjectCatalogEntry[]
}

/**
 * Reruns a command from its stored row: classify, Parse and Plan are skipped (the frozen root is
 * their output), and `compileAttemptsFromSkeleton` runs against the world as it is now, with the
 * row's answers applied. A stale answer comes back as an `Error` carrying the reason.
 */
export const resumePersistentCommand = (
    payload: PersistentCommandPayload,
    world: PersistentCommandWorld,
    deps: CompileAttemptsFromSkeletonDeps = {}
): Promise<CompileAttemptsFromSkeletonResult> => {
    const { root, selectedAttempt, referentAnswers, challengeAnswers } = payload
    return compileAttemptsFromSkeleton(
        {
            command: root.command,
            skeleton: root.skeleton,
            attempts: root.attempts.map((data) => CommandAttempt.fromJSON(data)),
            ...world,
            answers: { selectedAttempt, referentAnswers, challengeAnswers },
        },
        root.confidence,
        deps
    )
}
