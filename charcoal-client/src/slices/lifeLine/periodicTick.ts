import type { LifeLinePubSubData, PeriodicTickLifeLineMessage } from './lifeLine'
import { LifeLinePubSub } from './lifeLinePubSub'

export type { PeriodicTickLifeLineMessage }

export const PERIODIC_TICK_DEFAULT_INTERVAL_MS = 30_000

export function isPeriodicTickLifeLineMessage(
    payload: LifeLinePubSubData
): payload is PeriodicTickLifeLineMessage {
    return (
        payload.messageType === 'PeriodicTick'
        && 'now' in payload
        && typeof payload.now === 'number'
    )
}

type IntervalType = ReturnType<typeof setInterval>

let activeInterval: IntervalType | null = null

export function startPeriodicTickPublisher(options?: {
    intervalMs?: number
    getNow?: () => number
}): IntervalType {
    if (activeInterval) {
        return activeInterval
    }
    const intervalMs = options?.intervalMs ?? PERIODIC_TICK_DEFAULT_INTERVAL_MS
    const getNow = options?.getNow ?? Date.now
    activeInterval = setInterval(() => {
        LifeLinePubSub.publish({ messageType: 'PeriodicTick', now: getNow() })
    }, intervalMs)
    return activeInterval
}

export function stopPeriodicTickPublisher(): void {
    if (activeInterval) {
        clearInterval(activeInterval)
    }
    activeInterval = null
}

function registerPeriodicTickSmokeSubscriber(): void {
    LifeLinePubSub.subscribe(({ payload }) => {
        if (!isPeriodicTickLifeLineMessage(payload)) {
            return
        }
        // Phase 0 smoke: remove before Phase 2 lands pruneStaleRequestCorrelation
        console.log('[PeriodicTick]', payload.now)
    })
}

registerPeriodicTickSmokeSubscriber()
