import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

import type { ScopedInstrumentationOptions } from '../../../testing/scopedInstrumentation'
import { literalPlainString, type WorkbenchAssetMetaWorking } from './workbenchMutations'

/** Activation key for `WorkbenchComponentProvider` flush / reconcile logs. */
export const WORKBENCH_COMPONENT_SESSION_INSTRUMENTATION_KEY = 'workbench-component-session'

/** Activation key for `WorkbenchAssetMetaProvider` flush / reconcile logs. */
export const WORKBENCH_ASSET_META_SESSION_INSTRUMENTATION_KEY = 'workbench-asset-meta-session'

const SESSION_STORAGE_KEY = 'mtw-instrumentation'

/**
 * Enable workbench session logs from the browser console (no rebuild):
 *
 *   sessionStorage.setItem('mtw-instrumentation', '["workbench-component-session"]')
 *
 * Asset meta session:
 *
 *   sessionStorage.setItem('mtw-instrumentation', '["workbench-asset-meta-session"]')
 *
 * Disable:
 *
 *   sessionStorage.removeItem('mtw-instrumentation')
 *
 * Or pass `instrumentation={{ instrumentation: ['workbench-component-session'] }}` on the provider.
 */
export const isWorkbenchSessionInstrumentationEnabled = (
    sessionKey: string,
    options?: ScopedInstrumentationOptions
): boolean => {
    if (options?.instrumentation?.includes(sessionKey)) {
        return true
    }
    if (typeof sessionStorage === 'undefined') {
        return false
    }
    try {
        const raw = sessionStorage.getItem(SESSION_STORAGE_KEY)
        if (!raw) {
            return false
        }
        const parsed: unknown = JSON.parse(raw)
        return Array.isArray(parsed) && parsed.includes(sessionKey)
    } catch {
        return false
    }
}

export const logWorkbenchSession = (
    sessionKey: string,
    options: ScopedInstrumentationOptions | undefined,
    event: string,
    detail: Record<string, unknown>
): void => {
    if (!isWorkbenchSessionInstrumentationEnabled(sessionKey, options)) {
        return
    }
    console.log(`[${sessionKey}] ${event}`, detail)
}

export const componentSessionSnapshot = (
    component: StandardComponent | undefined
): Record<string, unknown> | undefined => {
    if (!component) {
        return undefined
    }
    const shortNameJson = component.shortName?.toJSON()
    return {
        universalKey: component.universalKey,
        shortName:
            literalPlainString(component.shortName) ??
            (typeof shortNameJson === 'string' ? shortNameJson : shortNameJson)
    }
}

export const assetMetaSessionSnapshot = (
    meta: WorkbenchAssetMetaWorking | undefined
): Record<string, unknown> | undefined => {
    if (!meta) {
        return undefined
    }
    const shortNameJson = meta.shortName?.toJSON()
    return {
        shortName:
            literalPlainString(meta.shortName) ??
            (typeof shortNameJson === 'string' ? shortNameJson : shortNameJson),
        hasSummary: meta.summary !== undefined && !meta.summary.isEmpty(),
        topLevelCount: meta.topLevel.payload.length
    }
}
