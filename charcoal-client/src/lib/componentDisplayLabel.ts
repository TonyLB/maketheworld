/**
 * Platform display-label contract for StandardComponent (charcoal-client presentation layer).
 *
 * Human-readable sources only, in order:
 * 1. shortName
 * 2. displayName (Character only, via hasDisplayName)
 * 3. key (when includeKeyFallback is true, default)
 * 4. Situation marks-summary via situationIdToLabel when standardForm is provided
 *
 * Does not fall back to universalKey or uuid suffixes. When nothing matches, returns
 * fallbackLabel if set, otherwise undefined. Callers supply defaults (e.g. 'Untitled').
 *
 * mtw-wml exposes field accessors only; this module is not exported from @tonylb/mtw-wml.
 */

import type { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import type { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { hasDisplayName } from '@tonylb/mtw-wml/ts/standardize'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import StandardSituation from '@tonylb/mtw-wml/ts/standardize/components/situation'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'
import { schemaOutputToString } from '@tonylb/mtw-wml/ts/schema/utils/schemaOutput/schemaOutputToString'
import { situationIdToLabel } from './situationLabel'

export type ComponentDisplayLabelOptions = {
    /** Required for Situation marks-summary fallback (delegates to situationIdToLabel). */
    standardForm?: StandardForm | null
    /** When false, skip key in the chain. Default true. */
    includeKeyFallback?: boolean
    /** Returned when the chain produces nothing; otherwise undefined. */
    fallbackLabel?: string
}

function nonEmptyString(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
}

function plainShortName(component: StandardComponent): string | undefined {
    return nonEmptyString(component.shortName?.toJSON())
}

function plainDisplayName(component: StandardComponent): string | undefined {
    if (!hasDisplayName(component) || !component.displayName) {
        return undefined
    }
    const dn = component.displayName
    if (dn instanceof StandardLiteral) {
        return nonEmptyString(dn.toJSON())
    }
    if ('plainString' in dn && typeof (dn as { plainString?: string }).plainString === 'string') {
        return nonEmptyString((dn as { plainString: string }).plainString)
    }
    if ('children' in dn && Array.isArray((dn as { children?: unknown }).children)) {
        return nonEmptyString(
            schemaOutputToString((dn as { children: Parameters<typeof schemaOutputToString>[0] }).children)
        )
    }
    return undefined
}

function plainKey(component: StandardComponent): string | undefined {
    const keyValue = component.key
    if (typeof keyValue === 'string') {
        return nonEmptyString(keyValue)
    }
    if (keyValue && typeof keyValue === 'object' && 'toJSON' in keyValue) {
        return nonEmptyString((keyValue as { toJSON: () => unknown }).toJSON())
    }
    return undefined
}

/**
 * Resolves a human-readable display label for a component using the platform fallback chain.
 */
export function componentDisplayLabel(
    component: StandardComponent,
    options?: ComponentDisplayLabelOptions
): string | undefined {
    const shortName = plainShortName(component)
    if (shortName) return shortName

    const displayName = plainDisplayName(component)
    if (displayName) return displayName

    const includeKeyFallback = options?.includeKeyFallback !== false
    if (includeKeyFallback) {
        const key = plainKey(component)
        if (key) return key
    }

    if (
        component instanceof StandardSituation &&
        component.universalKey &&
        options?.standardForm
    ) {
        return situationIdToLabel(component.universalKey as ComponentUUID, options.standardForm)
    }

    if (options?.fallbackLabel !== undefined) {
        return options.fallbackLabel
    }
    return undefined
}
