/**
 * In-memory render targeting registry (PerceptionThreads). Cleared each lambda invocation via InternalCache.clear().
 * See lambda/ephemera/dataSource/perception/AGENT.md (Normative decisions and obligations).
 *
 * Multiple independent entries may share the same (componentId, perspectiveKey); each is a separate output request.
 *
 * Phase 7: retreated to its final, permanent role --- `roomHeaderBroadcast` (multi-target,
 * room-content-driven, no actor) and `sessionOrientationAffordances` (no placeholder wave, no
 * cache-record content shape, deferred). Every directed-consequence render kind
 * (`roomDescription`/`featureDescription`/`knowledgeDescription`/`objectDescription`/
 * `sessionOrientationRender`) now registers against `messageOrchestration`'s ingress registry
 * instead (`dataSource/messageOrchestration/contentIngress.ts`) --- see that package's
 * `AGENT.md`, "Phase 7: all directed render kinds migrated".
 */
import { v4 as uuidv4 } from 'uuid'
import {
    type PerceptionThreadRegisterCommand,
} from '../dataSource/perception/localApiEvents'

/** Multi-target room header fan-in (passive render + broadcast delivery per perspectiveKey). */
export type RoomHeaderBroadcastPerceptionThread = {
    kind: 'roomHeaderBroadcast';
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

export type PerceptionThread =
    | RoomHeaderBroadcastPerceptionThread
    | SessionOrientationAffordancesPerceptionThread

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

export function isPerceptionThread(value: unknown): value is PerceptionThread {
    return (
        isRoomHeaderBroadcastPerceptionThread(value)
        || isSessionOrientationAffordancesPerceptionThread(value)
    )
}

/** Discriminated patch for `update`; `threadKind` matches the thread body `kind` it applies to. */
export type RoomHeaderBroadcastPerceptionThreadPatch = {
    threadKind: 'roomHeaderBroadcast';
    status?: RoomHeaderBroadcastPerceptionThread['status'];
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

export type PerceptionThreadPatch =
    | RoomHeaderBroadcastPerceptionThreadPatch
    | SessionOrientationAffordancesPerceptionThreadPatch

const ROOM_HEADER_BROADCAST_PATCH_KEYS = new Set<string>(['threadKind', 'status', 'messageId', 'createdTime', 'cacheId'])
const SESSION_ORIENTATION_AFFORDANCES_PATCH_KEYS = new Set<string>(['threadKind', 'status', 'messageId', 'cacheId'])

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

export function isPerceptionThreadPatch(value: unknown): value is PerceptionThreadPatch {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false
    }
    const p = value as Record<string, unknown>
    if (p.threadKind === 'roomHeaderBroadcast') {
        return isRoomHeaderBroadcastPerceptionThreadPatch(value)
    }
    if (p.threadKind === 'sessionOrientationAffordances') {
        return isSessionOrientationAffordancesPerceptionThreadPatch(value)
    }
    return false
}

/**
 * Shallow-merge a validated patch into a thread of the same logical kind (`threadKind` matches `base.kind`).
 * Throws if the patch targets a different kind than `base`.
 */
export function mergePerceptionThreadPatch(base: PerceptionThread, patch: PerceptionThreadPatch): PerceptionThread {
    switch (patch.threadKind) {
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
        default: {
            const _never: never = patch
            void _never
            throw new Error('PerceptionThreads.mergePerceptionThreadPatch: unexpected patch.threadKind')
        }
    }
}

function assertRegistrationMatchesThread(entry: PerceptionThreadEntry): void {
    const { registration, thread } = entry
    if (registration.threadKind === 'roomHeaderBroadcast') {
        if (thread.kind !== 'roomHeaderBroadcast') {
            throw new Error(
                'PerceptionThreads.update: registration.threadKind roomHeaderBroadcast does not match stored thread.kind'
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
            case 'roomHeaderBroadcast':
                thread = { kind: 'roomHeaderBroadcast', status: 'Initial' }
                break
            case 'sessionOrientationAffordances':
                thread = { kind: 'sessionOrientationAffordances', status: 'Initial' }
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
