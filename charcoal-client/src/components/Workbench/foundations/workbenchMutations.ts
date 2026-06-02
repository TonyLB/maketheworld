import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

export type ReconcileCommittedComponentParams<T extends StandardComponent> = {
    lastReceived: T | undefined
    working: T | undefined
    incoming: T | undefined
}

export type ReconcileCommittedComponentResult<T extends StandardComponent> = {
    working: T | undefined
    lastReceived: T | undefined
    superseded: boolean
}

const cloneComponent = <T extends StandardComponent>(component: T): T =>
    component.clone() as T

/**
 * Three-way reconcile when Redux `committed` changes without this session's flush (D14).
 * Pure helper for unit tests and `useWorkbenchComponent`.
 */
export const reconcileCommittedComponent = <T extends StandardComponent>({
    lastReceived,
    working,
    incoming
}: ReconcileCommittedComponentParams<T>): ReconcileCommittedComponentResult<T> => {
    if (incoming === undefined) {
        return { working: undefined, lastReceived: undefined, superseded: false }
    }

    const incomingBaseline = cloneComponent(incoming)

    if (lastReceived === undefined || working === undefined) {
        return {
            working: cloneComponent(incoming),
            lastReceived: incomingBaseline,
            superseded: false
        }
    }

    const editDiff = lastReceived.diff(working)
    if (editDiff === undefined) {
        if (!lastReceived.equals(working)) {
            return {
                working: cloneComponent(incoming),
                lastReceived: incomingBaseline,
                superseded: true
            }
        }
        return {
            working: cloneComponent(incoming),
            lastReceived: incomingBaseline,
            superseded: false
        }
    }

    try {
        const merged = incoming.merge(editDiff)
        if (merged === undefined) {
            return {
                working: cloneComponent(incoming),
                lastReceived: incomingBaseline,
                superseded: false
            }
        }
        return {
            working: cloneComponent(merged as T),
            lastReceived: incomingBaseline,
            superseded: false
        }
    } catch {
        return {
            working: cloneComponent(incoming),
            lastReceived: incomingBaseline,
            superseded: true
        }
    }
}
