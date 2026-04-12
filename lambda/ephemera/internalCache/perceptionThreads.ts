/**
 * In-memory perception fan-in threads (PerceptionThreads). Cleared each lambda invocation via InternalCache.clear().
 * See taskPlanning/lambda/ephemera/dataSource/perception/AGENT.perceptionRefactor.planning.md steps 3-4.
 *
 * Multiple independent entries may share the same (componentId, perspectiveKey); each is a separate output request.
 */
import { isEphemeraCharacterId, type EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { v4 as uuidv4 } from 'uuid'
import {
    isCharacterMoveWorldMessageSpec,
    type CharacterMoveWorldMessageSpec,
    type PerceptionThreadRegisterCharacterMoveCommand,
    type PerceptionThreadRegisterCommand,
} from '../dataSource/perception/localApiEvents'

/** Stub thread body; more variants may be added in later refactor steps. */
export type StubPerceptionThread = {
    kind: 'stub';
}

/**
 * Correlated room full-description delivery. After terminal PublishMessage we need not retain finished
 * render in this bucket (unlike future thread types that may keep summaries for later fan-in).
 */
export type RoomDescriptionPerceptionThread = {
    kind: 'roomDescription';
    status: 'Initial' | 'Generating' | 'Terminal';
    messageId?: string;
    cacheId?: string;
}

/** Room header broadcast: multi-target Generating + terminal header fan-in (targets live on registration). */
export type RoomHeaderBroadcastPerceptionThread = {
    kind: 'roomHeaderBroadcast';
    status: 'Initial' | 'Generating' | 'Terminal';
    messageId?: string;
    cacheId?: string;
}

/** Character move: header fan-in + Leave/Arrive WorldMessage specs on registration (see characterMoveDelivery). */
export type CharacterMovePerceptionThread = {
    kind: 'characterMove';
    status: 'Initial' | 'Generating' | 'Terminal';
    messageId?: string;
    cacheId?: string;
    leaveDispatched?: boolean;
    arriveDispatched?: boolean;
}

export type PerceptionThread =
    | StubPerceptionThread
    | RoomDescriptionPerceptionThread
    | RoomHeaderBroadcastPerceptionThread
    | CharacterMovePerceptionThread

export function isStubPerceptionThread(value: unknown): value is StubPerceptionThread {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    return v.kind === 'stub'
}

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
    if (v.cacheId !== undefined && typeof v.cacheId !== 'string') {
        return false
    }
    if (v.leaveDispatched !== undefined && typeof v.leaveDispatched !== 'boolean') {
        return false
    }
    if (v.arriveDispatched !== undefined && typeof v.arriveDispatched !== 'boolean') {
        return false
    }
    return true
}

export function isPerceptionThread(value: unknown): value is PerceptionThread {
    return (
        isStubPerceptionThread(value)
        || isRoomDescriptionPerceptionThread(value)
        || isRoomHeaderBroadcastPerceptionThread(value)
        || isCharacterMovePerceptionThread(value)
    )
}

/** Discriminated patch for `update`; `threadKind` matches the thread body `kind` it applies to. */
export type RoomDescriptionPerceptionThreadPatch = {
    threadKind: 'roomDescription';
    status?: RoomDescriptionPerceptionThread['status'];
    messageId?: string;
    cacheId?: string;
}

export type StubPerceptionThreadPatch = {
    threadKind: 'stub';
}

export type RoomHeaderBroadcastPerceptionThreadPatch = {
    threadKind: 'roomHeaderBroadcast';
    status?: RoomHeaderBroadcastPerceptionThread['status'];
    messageId?: string;
    cacheId?: string;
}

export type CharacterMovePerceptionThreadPatch = {
    threadKind: 'characterMove';
    status?: CharacterMovePerceptionThread['status'];
    messageId?: string;
    cacheId?: string;
    leaveDispatched?: boolean;
    arriveDispatched?: boolean;
    leaveWorldMessage?: CharacterMoveWorldMessageSpec;
    arriveWorldMessage?: CharacterMoveWorldMessageSpec;
    headerTargets?: EphemeraCharacterId[];
}

export type PerceptionThreadPatch =
    | RoomDescriptionPerceptionThreadPatch
    | RoomHeaderBroadcastPerceptionThreadPatch
    | CharacterMovePerceptionThreadPatch
    | StubPerceptionThreadPatch

const ROOM_DESCRIPTION_PATCH_KEYS = new Set<string>(['threadKind', 'status', 'messageId', 'cacheId'])
const ROOM_HEADER_BROADCAST_PATCH_KEYS = new Set<string>(['threadKind', 'status', 'messageId', 'cacheId'])
const CHARACTER_MOVE_PATCH_KEYS = new Set<string>([
    'threadKind',
    'status',
    'messageId',
    'cacheId',
    'leaveDispatched',
    'arriveDispatched',
    'leaveWorldMessage',
    'arriveWorldMessage',
    'headerTargets',
])

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
    if ('cacheId' in p && p.cacheId !== undefined && typeof p.cacheId !== 'string') {
        return false
    }
    if ('leaveDispatched' in p && p.leaveDispatched !== undefined && typeof p.leaveDispatched !== 'boolean') {
        return false
    }
    if ('arriveDispatched' in p && p.arriveDispatched !== undefined && typeof p.arriveDispatched !== 'boolean') {
        return false
    }
    if ('leaveWorldMessage' in p && p.leaveWorldMessage !== undefined && !isCharacterMoveWorldMessageSpec(p.leaveWorldMessage)) {
        return false
    }
    if ('arriveWorldMessage' in p && p.arriveWorldMessage !== undefined && !isCharacterMoveWorldMessageSpec(p.arriveWorldMessage)) {
        return false
    }
    if (
        'headerTargets' in p
        && p.headerTargets !== undefined
        && (!Array.isArray(p.headerTargets)
            || p.headerTargets.length === 0
            || !p.headerTargets.every((t) => typeof t === 'string' && isEphemeraCharacterId(t)))
    ) {
        return false
    }
    return true
}

export function isStubPerceptionThreadPatch(value: unknown): value is StubPerceptionThreadPatch {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false
    }
    const p = value as Record<string, unknown>
    if (p.threadKind !== 'stub') {
        return false
    }
    return Object.keys(p).length === 1 && p.threadKind === 'stub'
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
    if (p.threadKind === 'characterMove') {
        return isCharacterMovePerceptionThreadPatch(value)
    }
    if (p.threadKind === 'stub') {
        return isStubPerceptionThreadPatch(value)
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
        case 'characterMove': {
            if (base.kind !== 'characterMove') {
                throw new Error(
                    'PerceptionThreads.mergePerceptionThreadPatch: characterMove patch requires characterMove thread'
                )
            }
            const {
                threadKind: _tk,
                leaveWorldMessage: _lw,
                arriveWorldMessage: _aw,
                headerTargets: _ht,
                ...threadRest
            } = patch
            const merged = { ...base, ...threadRest }
            if (!isCharacterMovePerceptionThread(merged)) {
                throw new Error(
                    'PerceptionThreads.mergePerceptionThreadPatch: merged characterMove thread failed validation'
                )
            }
            return merged
        }
        case 'stub': {
            if (base.kind !== 'stub') {
                throw new Error('PerceptionThreads.mergePerceptionThreadPatch: stub patch requires stub thread')
            }
            return { ...base }
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
    if (registration.threadKind === 'characterMove') {
        if (thread.kind !== 'characterMove') {
            throw new Error(
                'PerceptionThreads.update: registration.threadKind characterMove does not match stored thread.kind'
            )
        }
        return
    }
    if (registration.threadKind === 'stub') {
        if (thread.kind !== 'stub') {
            throw new Error(
                'PerceptionThreads.update: registration.threadKind stub does not match stored thread.kind'
            )
        }
        return
    }
    const _exhaustive: never = registration
    void _exhaustive
    throw new Error('PerceptionThreads.update: unexpected registration.threadKind')
}

function mergeCharacterMoveRegistration(
    reg: PerceptionThreadRegisterCharacterMoveCommand,
    patch: CharacterMovePerceptionThreadPatch
): PerceptionThreadRegisterCharacterMoveCommand {
    let next: PerceptionThreadRegisterCharacterMoveCommand = { ...reg }
    if (patch.leaveWorldMessage !== undefined) {
        next = { ...next, leaveWorldMessage: patch.leaveWorldMessage }
    }
    if (patch.arriveWorldMessage !== undefined) {
        next = { ...next, arriveWorldMessage: patch.arriveWorldMessage }
    }
    if (patch.headerTargets !== undefined) {
        next = { ...next, headerTargets: patch.headerTargets }
    }
    return next
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
            case 'characterMove':
                thread = { kind: 'characterMove', status: 'Initial' }
                break
            case 'stub':
                thread = { kind: 'stub' }
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
     * disagree, if the row kind does not support updates (stub), or if `partial` is not a valid
     * {@link PerceptionThreadPatch} / fails merge (e.g. patch `threadKind` does not match the row).
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
        switch (entry.thread.kind) {
            case 'stub':
                throw new Error('PerceptionThreads.update: stub threads do not support updates')
            case 'roomDescription': {
                if (!isPerceptionThreadPatch(partial)) {
                    throw new Error('PerceptionThreads.update: not a valid PerceptionThreadPatch')
                }
                entry.thread = mergePerceptionThreadPatch(entry.thread, partial)
                return true
            }
            case 'roomHeaderBroadcast': {
                if (!isPerceptionThreadPatch(partial)) {
                    throw new Error('PerceptionThreads.update: not a valid PerceptionThreadPatch')
                }
                entry.thread = mergePerceptionThreadPatch(entry.thread, partial)
                return true
            }
            case 'characterMove': {
                if (!isCharacterMovePerceptionThreadPatch(partial)) {
                    throw new Error('PerceptionThreads.update: not a valid PerceptionThreadPatch')
                }
                if (entry.registration.threadKind !== 'characterMove') {
                    throw new Error('PerceptionThreads.update: registration not characterMove')
                }
                const p = partial
                entry.registration = mergeCharacterMoveRegistration(entry.registration, p)
                const hasThreadPatchFields =
                    p.status !== undefined
                    || p.messageId !== undefined
                    || p.cacheId !== undefined
                    || p.leaveDispatched !== undefined
                    || p.arriveDispatched !== undefined
                if (hasThreadPatchFields) {
                    entry.thread = mergePerceptionThreadPatch(entry.thread, {
                        threadKind: 'characterMove',
                        status: p.status,
                        messageId: p.messageId,
                        cacheId: p.cacheId,
                        leaveDispatched: p.leaveDispatched,
                        arriveDispatched: p.arriveDispatched,
                    })
                }
                return true
            }
            default: {
                const _never: never = entry.thread
                throw new Error(
                    `PerceptionThreads.update: unhandled thread.kind ${String((_never as PerceptionThread).kind)}`
                )
            }
        }
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
