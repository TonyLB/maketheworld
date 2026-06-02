import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import type { ShortNamePayloadHost } from '@tonylb/mtw-wml/ts/standardize/components/shortNameField'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'

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

type ComponentWithShortNamePayload = StandardComponent & {
    _payload: ShortNamePayloadHost
}

/** Stable plain string for UI/tests. */
export const literalPlainString = (literal?: StandardLiteral): string => {
    const json = literal?.toJSON()
    return typeof json === 'string' ? json : ''
}

/**
 * D11 omission-over-empty: empty / whitespace-only -> undefined; else trimmed literal.
 */
export const normalizeOptionalLiteral = (
    literal?: StandardLiteral
): StandardLiteral | undefined => {
    if (!literal) {
        return undefined
    }
    const plain = literalPlainString(literal)
    if (!plain.trim()) {
        return undefined
    }
    return new StandardLiteral(plain.trim())
}

/** Apply D11 shortName normalization on a component payload (mutates in place). */
export const applyShortNameOnComponent = <T extends StandardComponent>(component: T): void => {
    const payload = (component as unknown as ComponentWithShortNamePayload)._payload
    if (!payload) {
        return
    }
    payload._shortName = normalizeOptionalLiteral(component.shortName)
}

/** Clone working copy and normalize shortName before flush (D11). */
export const prepareComponentForFlush = <T extends StandardComponent>(component: T): T => {
    const flushed = component.clone() as T
    applyShortNameOnComponent(flushed)
    return flushed
}

/** Set shortName on working copy from a string (no trim; flush normalizes per D11). */
export const setWorkingShortNameFromString = <T extends StandardComponent = StandardComponent>(
    component: T,
    value: string
): void => {
    const payload = (component as unknown as ComponentWithShortNamePayload)._payload
    payload._shortName = value ? new StandardLiteral(value) : undefined
}

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
