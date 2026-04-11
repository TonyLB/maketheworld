/**
 * In-memory perception fan-in threads (PerceptionThreads). Cleared each lambda invocation via InternalCache.clear().
 * See taskPlanning/lambda/ephemera/dataSource/perception/AGENT.perceptionRefactor.planning.md steps 3-4.
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

/**
 * Map key is `${componentId}::${perspectiveKey}`. perspectiveKey must not contain '::'.
 * Duplicate set for the same pair: last write wins.
 */
export default class PerceptionThreadsData {
    private threads: Record<string, PerceptionThreadEntry> = {}

    private static makeKey(componentId: string, perspectiveKey: string): string {
        return `${componentId}::${perspectiveKey}`
    }

    set(
        registration: PerceptionThreadRegisteredCommand,
        thread: PerceptionThread = { kind: 'stub' }
    ): void {
        const { componentId, perspectiveKey } = registration
        const key = PerceptionThreadsData.makeKey(componentId, perspectiveKey)
        const registrationId = registration.registrationId ?? uuidv4()
        this.threads[key] = { registrationId, thread, registration }
    }

    get(componentId: string, perspectiveKey: string): PerceptionThreadEntry | undefined {
        return this.threads[PerceptionThreadsData.makeKey(componentId, perspectiveKey)]
    }

    /**
     * Shallow-merge partial thread fields into the stored thread after registrationId matches.
     */
    update(key: PerceptionThreadUpdateKey, partial: Partial<PerceptionThread>): boolean {
        const entry = this.threads[PerceptionThreadsData.makeKey(key.componentId, key.perspectiveKey)]
        if (!entry || entry.registrationId !== key.registrationId) {
            return false
        }
        entry.thread = { ...entry.thread, ...partial } as PerceptionThread
        return true
    }

    /** Remove one registration row (e.g. after terminal room description delivery). */
    delete(componentId: string, perspectiveKey: string): void {
        delete this.threads[PerceptionThreadsData.makeKey(componentId, perspectiveKey)]
    }

    clear(): void {
        this.threads = {}
    }
}
