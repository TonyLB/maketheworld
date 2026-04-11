/**
 * In-memory perception fan-in threads (PerceptionThreads). Cleared each lambda invocation via InternalCache.clear().
 * See taskPlanning/lambda/ephemera/dataSource/perception/AGENT.perceptionRefactor.planning.md step 3.
 */
import type { PerceptionThreadRegisteredCommand } from '../dataSource/perception/localApiEvents'

/** Stub thread body; more variants may be added in later refactor steps. */
export type StubPerceptionThread = {
    kind: 'stub';
}

export type PerceptionThread = StubPerceptionThread

export function isStubPerceptionThread(value: unknown): value is StubPerceptionThread {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    return v.kind === 'stub'
}

/** Alias for narrowing; equals isStubPerceptionThread while PerceptionThread is a single-member union. */
export const isPerceptionThread = isStubPerceptionThread

export type PerceptionThreadEntry = {
    thread: PerceptionThread;
    registration: PerceptionThreadRegisteredCommand;
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
        this.threads[key] = { thread, registration }
    }

    get(componentId: string, perspectiveKey: string): PerceptionThreadEntry | undefined {
        return this.threads[PerceptionThreadsData.makeKey(componentId, perspectiveKey)]
    }

    clear(): void {
        this.threads = {}
    }
}
