/**
 * In-memory perception fan-in threads (PerceptionThreads). Cleared each lambda invocation via InternalCache.clear().
 * See taskPlanning/lambda/ephemera/dataSource/perception/AGENT.perceptionRefactor.planning.md steps 3-4.
 *
 * Multiple independent entries may share the same (componentId, perspectiveKey); each is a separate output request.
 */
import { v4 as uuidv4 } from 'uuid'
import type { PerceptionThreadRegisteredCommand } from '../dataSource/perception/localApiEvents'

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

export type PerceptionThread = StubPerceptionThread | RoomDescriptionPerceptionThread

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

export function isPerceptionThread(value: unknown): value is PerceptionThread {
    return isStubPerceptionThread(value) || isRoomDescriptionPerceptionThread(value)
}

export type PerceptionThreadEntry = {
    /** Stable id for this registration; synthetic uuid when ingress omitted one. */
    registrationId: string;
    thread: PerceptionThread;
    registration: PerceptionThreadRegisteredCommand;
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
     */
    register(
        registration: PerceptionThreadRegisteredCommand,
        thread: PerceptionThread = { kind: 'stub' }
    ): void {
        const { componentId, perspectiveKey } = registration
        const key = PerceptionThreadsData.makeKey(componentId, perspectiveKey)
        const registrationId = registration.registrationId ?? uuidv4()
        const entry: PerceptionThreadEntry = {
            registrationId,
            thread,
            registration: { ...registration, registrationId },
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
     * Shallow-merge partial thread fields into the stored thread after registrationId matches within the bucket.
     */
    update(key: PerceptionThreadUpdateKey, partial: Partial<PerceptionThread>): boolean {
        const bucket = this.buckets[PerceptionThreadsData.makeKey(key.componentId, key.perspectiveKey)]
        if (!bucket) {
            return false
        }
        const entry = bucket.find((e) => e.registrationId === key.registrationId)
        if (!entry) {
            return false
        }
        entry.thread = { ...entry.thread, ...partial } as PerceptionThread
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
