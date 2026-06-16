/**
 * In-memory render targeting registry (PerceptionThreads). Cleared each lambda invocation via InternalCache.clear().
 * See lambda/ephemera/dataSource/perception/AGENT.md (Normative decisions and obligations).
 *
 * Multiple independent entries may share the same (componentId, perspectiveKey); each is a separate output request.
 */
import { v4 as uuidv4 } from 'uuid'
import {
    type PerceptionThreadRegisterCommand,
} from '../dataSource/perception/localApiEvents'

/**
 * Correlated room full-description delivery. After terminal PublishMessage we need not retain finished
 * render in this bucket (unlike future thread types that may keep summaries for later fan-in).
 */
export type RoomDescriptionPerceptionThread = {
    kind: 'roomDescription';
    status: 'Initial' | 'Generating' | 'Terminal';
    messageId?: string;
    createdTime?: number;
    cacheId?: string;
}

/** Room header broadcast: multi-target Generating + terminal header fan-in (targets live on registration). */
export type RoomHeaderBroadcastPerceptionThread = {
    kind: 'roomHeaderBroadcast';
    status: 'Initial' | 'Generating' | 'Terminal';
    messageId?: string;
    createdTime?: number;
    cacheId?: string;
}

/** Session orientation render: Generating + terminal header fan-in (SESSION# targets on registration). */
export type SessionOrientationRenderPerceptionThread = {
    kind: 'sessionOrientationRender';
    status: 'Initial' | 'Generating' | 'Terminal';
    messageId?: string;
    createdTime?: number;
    cacheId?: string;
}

/** Session orientation affordances: terminal only (no Generating replace pipeline). */
export type SessionOrientationAffordancesPerceptionThread = {
    kind: 'sessionOrientationAffordances';
    status: 'Initial' | 'Terminal';
    messageId?: string;
    cacheId?: string;
}

/** Character move: targeting-only registration for mover arrival-room header render fan-in. */
export type CharacterMovePerceptionThread = {
    kind: 'characterMove';
    status: 'Initial' | 'Generating' | 'Terminal';
    messageId?: string;
    createdTime?: number;
    cacheId?: string;
}

/** Feature description: correlated full-description fan-in (mirrors roomDescription lifecycle). */
export type FeatureDescriptionPerceptionThread = {
    kind: 'featureDescription';
    status: 'Initial' | 'Generating' | 'Terminal';
    messageId?: string;
    createdTime?: number;
    cacheId?: string;
}

/** Knowledge description: correlated full-description fan-in (mirrors roomDescription lifecycle). */
export type KnowledgeDescriptionPerceptionThread = {
    kind: 'knowledgeDescription';
    status: 'Initial' | 'Generating' | 'Terminal';
    messageId?: string;
    createdTime?: number;
    cacheId?: string;
}

export type PerceptionThread =
    | RoomDescriptionPerceptionThread
    | RoomHeaderBroadcastPerceptionThread
    | SessionOrientationRenderPerceptionThread
    | SessionOrientationAffordancesPerceptionThread
    | CharacterMovePerceptionThread
    | FeatureDescriptionPerceptionThread
    | KnowledgeDescriptionPerceptionThread

export function isRoomDescriptionPerceptionThread(value: unknown): value is RoomDescriptionPerceptionThread {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (v.kind !== 'roomDescription') {
        return false
    }
    const status = v.status
    if (status !== 'Initial' && status !== 'Generating' && status !== 'Terminal') {
        return false
    }
    if (v.messageId !== undefined && typeof v.messageId !== 'string') {
        return false
    }
    if (v.createdTime !== undefined && typeof v.createdTime !== 'number') {
        return false
    }
    if (v.cacheId !== undefined && typeof v.cacheId !== 'string') {
        return false
    }
    return true
}

export function isRoomHeaderBroadcastPerceptionThread(value: unknown): value is RoomHeaderBroadcastPerceptionThread {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (v.kind !== 'roomHeaderBroadcast') {
        return false
    }
    const status = v.status
    if (status !== 'Initial' && status !== 'Generating' && status !== 'Terminal') {
        return false
    }
    if (v.messageId !== undefined && typeof v.messageId !== 'string') {
        return false
    }
    if (v.createdTime !== undefined && typeof v.createdTime !== 'number') {
        return false
    }
    if (v.cacheId !== undefined && typeof v.cacheId !== 'string') {
        return false
    }
    return true
}

export function isSessionOrientationRenderPerceptionThread(
    value: unknown
): value is SessionOrientationRenderPerceptionThread {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (v.kind !== 'sessionOrientationRender') {
        return false
    }
    const status = v.status
    if (status !== 'Initial' && status !== 'Generating' && status !== 'Terminal') {
        return false
    }
    if (v.messageId !== undefined && typeof v.messageId !== 'string') {
        return false
    }
    if (v.createdTime !== undefined && typeof v.createdTime !== 'number') {
        return false
    }
    if (v.cacheId !== undefined && typeof v.cacheId !== 'string') {
        return false
    }
    return true
}

export function isSessionOrientationAffordancesPerceptionThread(
    value: unknown
): value is SessionOrientationAffordancesPerceptionThread {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (v.kind !== 'sessionOrientationAffordances') {
        return false
    }
    const status = v.status
    if (status !== 'Initial' && status !== 'Terminal') {
        return false
    }
    if (v.messageId !== undefined && typeof v.messageId !== 'string') {
        return false
    }
    if (v.cacheId !== undefined && typeof v.cacheId !== 'string') {
        return false
    }
    return true
}

export function isCharacterMovePerceptionThread(value: unknown): value is CharacterMovePerceptionThread {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (v.kind !== 'characterMove') {
        return false
    }
    const status = v.status
    if (status !== 'Initial' && status !== 'Generating' && status !== 'Terminal') {
        return false
    }
    if (v.messageId !== undefined && typeof v.messageId !== 'string') {
        return false
    }
    if (v.createdTime !== undefined && typeof v.createdTime !== 'number') {
        return false
    }
    if (v.cacheId !== undefined && typeof v.cacheId !== 'string') {
        return false
    }
    return true
}

function isDescriptionPerceptionThreadStatus(value: unknown): value is 'Initial' | 'Generating' | 'Terminal' {
    return value === 'Initial' || value === 'Generating' || value === 'Terminal'
}

function isDescriptionPerceptionThreadShape(value: unknown): boolean {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (!isDescriptionPerceptionThreadStatus(v.status)) {
        return false
    }
    if (v.messageId !== undefined && typeof v.messageId !== 'string') {
        return false
    }
    if (v.createdTime !== undefined && typeof v.createdTime !== 'number') {
        return false
    }
    if (v.cacheId !== undefined && typeof v.cacheId !== 'string') {
        return false
    }
    return true
}

export function isFeatureDescriptionPerceptionThread(value: unknown): value is FeatureDescriptionPerceptionThread {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    return v.kind === 'featureDescription' && isDescriptionPerceptionThreadShape(value)
}

export function isKnowledgeDescriptionPerceptionThread(value: unknown): value is KnowledgeDescriptionPerceptionThread {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    return v.kind === 'knowledgeDescription' && isDescriptionPerceptionThreadShape(value)
}

export function isPerceptionThread(value: unknown): value is PerceptionThread {
    return (
        isRoomDescriptionPerceptionThread(value)
        || isRoomHeaderBroadcastPerceptionThread(value)
        || isSessionOrientationRenderPerceptionThread(value)
        || isSessionOrientationAffordancesPerceptionThread(value)
        || isCharacterMovePerceptionThread(value)
        || isFeatureDescriptionPerceptionThread(value)
        || isKnowledgeDescriptionPerceptionThread(value)
    )
}

/** Discriminated patch for `update`; `threadKind` matches the thread body `kind` it applies to. */
export type RoomDescriptionPerceptionThreadPatch = {
    threadKind: 'roomDescription';
    status?: RoomDescriptionPerceptionThread['status'];
    messageId?: string;
    createdTime?: number;
    cacheId?: string;
}

export type RoomHeaderBroadcastPerceptionThreadPatch = {
    threadKind: 'roomHeaderBroadcast';
    status?: RoomHeaderBroadcastPerceptionThread['status'];
    messageId?: string;
    createdTime?: number;
    cacheId?: string;
}

export type SessionOrientationRenderPerceptionThreadPatch = {
    threadKind: 'sessionOrientationRender';
    status?: SessionOrientationRenderPerceptionThread['status'];
    messageId?: string;
    createdTime?: number;
    cacheId?: string;
}

export type SessionOrientationAffordancesPerceptionThreadPatch = {
    threadKind: 'sessionOrientationAffordances';
    status?: SessionOrientationAffordancesPerceptionThread['status'];
    messageId?: string;
    cacheId?: string;
}

export type CharacterMovePerceptionThreadPatch = {
    threadKind: 'characterMove';
    status?: CharacterMovePerceptionThread['status'];
    messageId?: string;
    createdTime?: number;
    cacheId?: string;
}

export type FeatureDescriptionPerceptionThreadPatch = {
    threadKind: 'featureDescription';
    status?: FeatureDescriptionPerceptionThread['status'];
    messageId?: string;
    createdTime?: number;
    cacheId?: string;
}

export type KnowledgeDescriptionPerceptionThreadPatch = {
    threadKind: 'knowledgeDescription';
    status?: KnowledgeDescriptionPerceptionThread['status'];
    messageId?: string;
    createdTime?: number;
    cacheId?: string;
}

export type PerceptionThreadPatch =
    | RoomDescriptionPerceptionThreadPatch
    | RoomHeaderBroadcastPerceptionThreadPatch
    | SessionOrientationRenderPerceptionThreadPatch
    | SessionOrientationAffordancesPerceptionThreadPatch
    | CharacterMovePerceptionThreadPatch
    | FeatureDescriptionPerceptionThreadPatch
    | KnowledgeDescriptionPerceptionThreadPatch

const ROOM_DESCRIPTION_PATCH_KEYS = new Set<string>(['threadKind', 'status', 'messageId', 'createdTime', 'cacheId'])
const ROOM_HEADER_BROADCAST_PATCH_KEYS = new Set<string>(['threadKind', 'status', 'messageId', 'createdTime', 'cacheId'])
const SESSION_ORIENTATION_RENDER_PATCH_KEYS = new Set<string>(['threadKind', 'status', 'messageId', 'createdTime', 'cacheId'])
const SESSION_ORIENTATION_AFFORDANCES_PATCH_KEYS = new Set<string>(['threadKind', 'status', 'messageId', 'cacheId'])
const CHARACTER_MOVE_PATCH_KEYS = new Set<string>(['threadKind', 'status', 'messageId', 'createdTime', 'cacheId'])
const FEATURE_DESCRIPTION_PATCH_KEYS = new Set<string>(['threadKind', 'status', 'messageId', 'createdTime', 'cacheId'])
const KNOWLEDGE_DESCRIPTION_PATCH_KEYS = new Set<string>(['threadKind', 'status', 'messageId', 'createdTime', 'cacheId'])

export function isRoomDescriptionPerceptionThreadPatch(value: unknown): value is RoomDescriptionPerceptionThreadPatch {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false
    }
    const p = value as Record<string, unknown>
    if (p.threadKind !== 'roomDescription') {
        return false
    }
    for (const key of Object.keys(p)) {
        if (!ROOM_DESCRIPTION_PATCH_KEYS.has(key)) {
            return false
        }
    }
    if ('status' in p && p.status !== undefined) {
        const s = p.status
        if (s !== 'Initial' && s !== 'Generating' && s !== 'Terminal') {
            return false
        }
    }
    if ('messageId' in p && p.messageId !== undefined && typeof p.messageId !== 'string') {
        return false
    }
    if ('createdTime' in p && p.createdTime !== undefined && typeof p.createdTime !== 'number') {
        return false
    }
    if ('cacheId' in p && p.cacheId !== undefined && typeof p.cacheId !== 'string') {
        return false
    }
    return true
}

export function isRoomHeaderBroadcastPerceptionThreadPatch(
    value: unknown
): value is RoomHeaderBroadcastPerceptionThreadPatch {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false
    }
    const p = value as Record<string, unknown>
    if (p.threadKind !== 'roomHeaderBroadcast') {
        return false
    }
    for (const key of Object.keys(p)) {
        if (!ROOM_HEADER_BROADCAST_PATCH_KEYS.has(key)) {
            return false
        }
    }
    if ('status' in p && p.status !== undefined) {
        const s = p.status
        if (s !== 'Initial' && s !== 'Generating' && s !== 'Terminal') {
            return false
        }
    }
    if ('messageId' in p && p.messageId !== undefined && typeof p.messageId !== 'string') {
        return false
    }
    if ('createdTime' in p && p.createdTime !== undefined && typeof p.createdTime !== 'number') {
        return false
    }
    if ('cacheId' in p && p.cacheId !== undefined && typeof p.cacheId !== 'string') {
        return false
    }
    return true
}

export function isSessionOrientationRenderPerceptionThreadPatch(
    value: unknown
): value is SessionOrientationRenderPerceptionThreadPatch {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false
    }
    const p = value as Record<string, unknown>
    if (p.threadKind !== 'sessionOrientationRender') {
        return false
    }
    for (const key of Object.keys(p)) {
        if (!SESSION_ORIENTATION_RENDER_PATCH_KEYS.has(key)) {
            return false
        }
    }
    if ('status' in p && p.status !== undefined) {
        const s = p.status
        if (s !== 'Initial' && s !== 'Generating' && s !== 'Terminal') {
            return false
        }
    }
    if ('messageId' in p && p.messageId !== undefined && typeof p.messageId !== 'string') {
        return false
    }
    if ('createdTime' in p && p.createdTime !== undefined && typeof p.createdTime !== 'number') {
        return false
    }
    if ('cacheId' in p && p.cacheId !== undefined && typeof p.cacheId !== 'string') {
        return false
    }
    return true
}

export function isSessionOrientationAffordancesPerceptionThreadPatch(
    value: unknown
): value is SessionOrientationAffordancesPerceptionThreadPatch {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false
    }
    const p = value as Record<string, unknown>
    if (p.threadKind !== 'sessionOrientationAffordances') {
        return false
    }
    for (const key of Object.keys(p)) {
        if (!SESSION_ORIENTATION_AFFORDANCES_PATCH_KEYS.has(key)) {
            return false
        }
    }
    if ('status' in p && p.status !== undefined) {
        const s = p.status
        if (s !== 'Initial' && s !== 'Terminal') {
            return false
        }
    }
    if ('messageId' in p && p.messageId !== undefined && typeof p.messageId !== 'string') {
        return false
    }
    if ('cacheId' in p && p.cacheId !== undefined && typeof p.cacheId !== 'string') {
        return false
    }
    return true
}

export function isCharacterMovePerceptionThreadPatch(value: unknown): value is CharacterMovePerceptionThreadPatch {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false
    }
    const p = value as Record<string, unknown>
    if (p.threadKind !== 'characterMove') {
        return false
    }
    for (const key of Object.keys(p)) {
        if (!CHARACTER_MOVE_PATCH_KEYS.has(key)) {
            return false
        }
    }
    if ('status' in p && p.status !== undefined) {
        const s = p.status
        if (s !== 'Initial' && s !== 'Generating' && s !== 'Terminal') {
            return false
        }
    }
    if ('messageId' in p && p.messageId !== undefined && typeof p.messageId !== 'string') {
        return false
    }
    if ('createdTime' in p && p.createdTime !== undefined && typeof p.createdTime !== 'number') {
        return false
    }
    if ('cacheId' in p && p.cacheId !== undefined && typeof p.cacheId !== 'string') {
        return false
    }
    return true
}

function isDescriptionPerceptionThreadPatch(
    value: unknown,
    threadKind: 'featureDescription' | 'knowledgeDescription',
    allowedKeys: Set<string>,
): value is FeatureDescriptionPerceptionThreadPatch | KnowledgeDescriptionPerceptionThreadPatch {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false
    }
    const p = value as Record<string, unknown>
    if (p.threadKind !== threadKind) {
        return false
    }
    for (const key of Object.keys(p)) {
        if (!allowedKeys.has(key)) {
            return false
        }
    }
    if ('status' in p && p.status !== undefined && !isDescriptionPerceptionThreadStatus(p.status)) {
        return false
    }
    if ('messageId' in p && p.messageId !== undefined && typeof p.messageId !== 'string') {
        return false
    }
    if ('createdTime' in p && p.createdTime !== undefined && typeof p.createdTime !== 'number') {
        return false
    }
    if ('cacheId' in p && p.cacheId !== undefined && typeof p.cacheId !== 'string') {
        return false
    }
    return true
}

export function isFeatureDescriptionPerceptionThreadPatch(
    value: unknown
): value is FeatureDescriptionPerceptionThreadPatch {
    return isDescriptionPerceptionThreadPatch(value, 'featureDescription', FEATURE_DESCRIPTION_PATCH_KEYS)
}

export function isKnowledgeDescriptionPerceptionThreadPatch(
    value: unknown
): value is KnowledgeDescriptionPerceptionThreadPatch {
    return isDescriptionPerceptionThreadPatch(value, 'knowledgeDescription', KNOWLEDGE_DESCRIPTION_PATCH_KEYS)
}

export function isPerceptionThreadPatch(value: unknown): value is PerceptionThreadPatch {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false
    }
    const p = value as Record<string, unknown>
    if (p.threadKind === 'roomDescription') {
        return isRoomDescriptionPerceptionThreadPatch(value)
    }
    if (p.threadKind === 'roomHeaderBroadcast') {
        return isRoomHeaderBroadcastPerceptionThreadPatch(value)
    }
    if (p.threadKind === 'sessionOrientationRender') {
        return isSessionOrientationRenderPerceptionThreadPatch(value)
    }
    if (p.threadKind === 'sessionOrientationAffordances') {
        return isSessionOrientationAffordancesPerceptionThreadPatch(value)
    }
    if (p.threadKind === 'characterMove') {
        return isCharacterMovePerceptionThreadPatch(value)
    }
    if (p.threadKind === 'featureDescription') {
        return isFeatureDescriptionPerceptionThreadPatch(value)
    }
    if (p.threadKind === 'knowledgeDescription') {
        return isKnowledgeDescriptionPerceptionThreadPatch(value)
    }
    return false
}

/**
 * Shallow-merge a validated patch into a thread of the same logical kind (`threadKind` matches `base.kind`).
 * Throws if the patch targets a different kind than `base`.
 */
export function mergePerceptionThreadPatch(base: PerceptionThread, patch: PerceptionThreadPatch): PerceptionThread {
    switch (patch.threadKind) {
        case 'roomDescription': {
            if (base.kind !== 'roomDescription') {
                throw new Error(
                    'PerceptionThreads.mergePerceptionThreadPatch: roomDescription patch requires roomDescription thread'
                )
            }
            const { threadKind: _, ...rest } = patch
            const merged = { ...base, ...rest }
            if (!isRoomDescriptionPerceptionThread(merged)) {
                throw new Error(
                    'PerceptionThreads.mergePerceptionThreadPatch: merged roomDescription thread failed validation'
                )
            }
            return merged
        }
        case 'roomHeaderBroadcast': {
            if (base.kind !== 'roomHeaderBroadcast') {
                throw new Error(
                    'PerceptionThreads.mergePerceptionThreadPatch: roomHeaderBroadcast patch requires roomHeaderBroadcast thread'
                )
            }
            const { threadKind: _, ...rest } = patch
            const merged = { ...base, ...rest }
            if (!isRoomHeaderBroadcastPerceptionThread(merged)) {
                throw new Error(
                    'PerceptionThreads.mergePerceptionThreadPatch: merged roomHeaderBroadcast thread failed validation'
                )
            }
            return merged
        }
        case 'sessionOrientationRender': {
            if (base.kind !== 'sessionOrientationRender') {
                throw new Error(
                    'PerceptionThreads.mergePerceptionThreadPatch: sessionOrientationRender patch requires sessionOrientationRender thread'
                )
            }
            const { threadKind: _, ...rest } = patch
            const merged = { ...base, ...rest }
            if (!isSessionOrientationRenderPerceptionThread(merged)) {
                throw new Error(
                    'PerceptionThreads.mergePerceptionThreadPatch: merged sessionOrientationRender thread failed validation'
                )
            }
            return merged
        }
        case 'sessionOrientationAffordances': {
            if (base.kind !== 'sessionOrientationAffordances') {
                throw new Error(
                    'PerceptionThreads.mergePerceptionThreadPatch: sessionOrientationAffordances patch requires sessionOrientationAffordances thread'
                )
            }
            const { threadKind: _, ...rest } = patch
            const merged = { ...base, ...rest }
            if (!isSessionOrientationAffordancesPerceptionThread(merged)) {
                throw new Error(
                    'PerceptionThreads.mergePerceptionThreadPatch: merged sessionOrientationAffordances thread failed validation'
                )
            }
            return merged
        }
        case 'characterMove': {
            if (base.kind !== 'characterMove') {
                throw new Error(
                    'PerceptionThreads.mergePerceptionThreadPatch: characterMove patch requires characterMove thread'
                )
            }
            const { threadKind: _, ...rest } = patch
            const merged = { ...base, ...rest }
            if (!isCharacterMovePerceptionThread(merged)) {
                throw new Error(
                    'PerceptionThreads.mergePerceptionThreadPatch: merged characterMove thread failed validation'
                )
            }
            return merged
        }
        case 'featureDescription': {
            if (base.kind !== 'featureDescription') {
                throw new Error(
                    'PerceptionThreads.mergePerceptionThreadPatch: featureDescription patch requires featureDescription thread'
                )
            }
            const { threadKind: _, ...rest } = patch
            const merged = { ...base, ...rest }
            if (!isFeatureDescriptionPerceptionThread(merged)) {
                throw new Error(
                    'PerceptionThreads.mergePerceptionThreadPatch: merged featureDescription thread failed validation'
                )
            }
            return merged
        }
        case 'knowledgeDescription': {
            if (base.kind !== 'knowledgeDescription') {
                throw new Error(
                    'PerceptionThreads.mergePerceptionThreadPatch: knowledgeDescription patch requires knowledgeDescription thread'
                )
            }
            const { threadKind: _, ...rest } = patch
            const merged = { ...base, ...rest }
            if (!isKnowledgeDescriptionPerceptionThread(merged)) {
                throw new Error(
                    'PerceptionThreads.mergePerceptionThreadPatch: merged knowledgeDescription thread failed validation'
                )
            }
            return merged
        }
        default: {
            const _never: never = patch
            void _never
            throw new Error('PerceptionThreads.mergePerceptionThreadPatch: unexpected patch.threadKind')
        }
    }
}

function assertRegistrationMatchesThread(entry: PerceptionThreadEntry): void {
    const { registration, thread } = entry
    if (registration.threadKind === 'roomDescription') {
        if (thread.kind !== 'roomDescription') {
            throw new Error(
                'PerceptionThreads.update: registration.threadKind roomDescription does not match stored thread.kind'
            )
        }
        return
    }
    if (registration.threadKind === 'roomHeaderBroadcast') {
        if (thread.kind !== 'roomHeaderBroadcast') {
            throw new Error(
                'PerceptionThreads.update: registration.threadKind roomHeaderBroadcast does not match stored thread.kind'
            )
        }
        return
    }
    if (registration.threadKind === 'sessionOrientationRender') {
        if (thread.kind !== 'sessionOrientationRender') {
            throw new Error(
                'PerceptionThreads.update: registration.threadKind sessionOrientationRender does not match stored thread.kind'
            )
        }
        return
    }
    if (registration.threadKind === 'sessionOrientationAffordances') {
        if (thread.kind !== 'sessionOrientationAffordances') {
            throw new Error(
                'PerceptionThreads.update: registration.threadKind sessionOrientationAffordances does not match stored thread.kind'
            )
        }
        return
    }
    if (registration.threadKind === 'characterMove') {
        if (thread.kind !== 'characterMove') {
            throw new Error(
                'PerceptionThreads.update: registration.threadKind characterMove does not match stored thread.kind'
            )
        }
        return
    }
    if (registration.threadKind === 'featureDescription') {
        if (thread.kind !== 'featureDescription') {
            throw new Error(
                'PerceptionThreads.update: registration.threadKind featureDescription does not match stored thread.kind'
            )
        }
        return
    }
    if (registration.threadKind === 'knowledgeDescription') {
        if (thread.kind !== 'knowledgeDescription') {
            throw new Error(
                'PerceptionThreads.update: registration.threadKind knowledgeDescription does not match stored thread.kind'
            )
        }
        return
    }
    const _exhaustive: never = registration
    void _exhaustive
    throw new Error('PerceptionThreads.update: unexpected registration.threadKind')
}

export type PerceptionThreadEntry = {
    /** Stable id for this registration; synthetic uuid when ingress omitted one. */
    registrationId: string;
    thread: PerceptionThread;
    registration: PerceptionThreadRegisterCommand;
}

export type PerceptionThreadUpdateKey = {
    componentId: string;
    perspectiveKey: string;
    registrationId: string;
}

export type PerceptionThreadRemoveKey = {
    componentId: string;
    perspectiveKey: string;
    registrationId: string;
}

/**
 * Map key is `${componentId}::${perspectiveKey}`. perspectiveKey must not contain '::'.
 * Each bucket holds zero or more independent PerceptionThreadEntry rows (append via register).
 */
export default class PerceptionThreadsData {
    private buckets: Record<string, PerceptionThreadEntry[]> = {}

    private static makeKey(componentId: string, perspectiveKey: string): string {
        return `${componentId}::${perspectiveKey}`
    }

    /**
     * Append a new thread row for this (componentId, perspectiveKey). Does not replace existing rows.
     * Initial thread body is derived from cmd.threadKind.
     */
    register(cmd: PerceptionThreadRegisterCommand): void {
        const { componentId, perspectiveKey } = cmd
        const key = PerceptionThreadsData.makeKey(componentId, perspectiveKey)
        const registrationId = cmd.registrationId ?? uuidv4()
        let thread: PerceptionThread
        switch (cmd.threadKind) {
            case 'roomDescription':
                thread = { kind: 'roomDescription', status: 'Initial' }
                break
            case 'roomHeaderBroadcast':
                thread = { kind: 'roomHeaderBroadcast', status: 'Initial' }
                break
            case 'sessionOrientationRender':
                thread = { kind: 'sessionOrientationRender', status: 'Initial' }
                break
            case 'sessionOrientationAffordances':
                thread = { kind: 'sessionOrientationAffordances', status: 'Initial' }
                break
            case 'characterMove':
                thread = {
                    kind: 'characterMove',
                    status: 'Initial',
                    ...(cmd.messageId !== undefined ? { messageId: cmd.messageId } : {}),
                    ...(cmd.createdTime !== undefined ? { createdTime: cmd.createdTime } : {}),
                }
                break
            case 'featureDescription':
                thread = { kind: 'featureDescription', status: 'Initial' }
                break
            case 'knowledgeDescription':
                thread = { kind: 'knowledgeDescription', status: 'Initial' }
                break
        }
        const entry: PerceptionThreadEntry = {
            registrationId,
            thread,
            registration: { ...cmd, registrationId },
        }
        if (!this.buckets[key]) {
            this.buckets[key] = []
        }
        this.buckets[key].push(entry)
    }

    /** All entries for the composite key (possibly empty). Returned array is a shallow copy. */
    list(componentId: string, perspectiveKey: string): PerceptionThreadEntry[] {
        const key = PerceptionThreadsData.makeKey(componentId, perspectiveKey)
        const bucket = this.buckets[key]
        return bucket ? [...bucket] : []
    }

    /**
     * Shallow-merge validated patch fields into the stored thread when `registrationId` matches a row in the bucket.
     *
     * Returns `false` if the composite key or `registrationId` is not found. Throws if `registration` and `thread.kind`
     * disagree or if `partial` is not a valid {@link PerceptionThreadPatch} / fails merge.
     */
    update(key: PerceptionThreadUpdateKey, partial: unknown): boolean {
        const bucket = this.buckets[PerceptionThreadsData.makeKey(key.componentId, key.perspectiveKey)]
        if (!bucket) {
            return false
        }
        const entry = bucket.find((e) => e.registrationId === key.registrationId)
        if (!entry) {
            return false
        }
        assertRegistrationMatchesThread(entry)
        if (!isPerceptionThreadPatch(partial)) {
            throw new Error('PerceptionThreads.update: not a valid PerceptionThreadPatch')
        }
        entry.thread = mergePerceptionThreadPatch(entry.thread, partial)
        return true
    }

    /** Remove one registration row from the bucket; drops empty buckets. */
    remove(key: PerceptionThreadRemoveKey): void {
        const composite = PerceptionThreadsData.makeKey(key.componentId, key.perspectiveKey)
        const bucket = this.buckets[composite]
        if (!bucket) {
            return
        }
        const next = bucket.filter((e) => e.registrationId !== key.registrationId)
        if (next.length === 0) {
            delete this.buckets[composite]
        } else {
            this.buckets[composite] = next
        }
    }

    clear(): void {
        this.buckets = {}
    }
}
