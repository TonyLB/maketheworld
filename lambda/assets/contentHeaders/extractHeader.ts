import { hasShortName } from '@tonylb/mtw-wml/ts/standardize'
import { standardComponentFactory } from '@tonylb/mtw-wml/ts/standardize/componentFactory'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { StandardRemove, StandardReplace } from '@tonylb/mtw-wml/ts/standardize/components/edits'
import { deepEqual } from '@tonylb/mtw-wml/ts/lib/objects'

export const extractHeader = (component: StandardComponent): StandardComponent | undefined => {
    // NOTE: Future serialization principle (documented in standardize/AGENT.md):
    // Prefer omission-over-empty in component toJSON outputs to minimize noise in header/subset payloads.
    // This utility constructs minimal JSON, relying on component serializers as-is for now.
    if (component instanceof StandardRemove) {
        const inner = extractHeader(component._match)
        return inner ? new StandardRemove(inner) : undefined
    }
    if (component instanceof StandardReplace) {
        const matchHeader = extractHeader(component._match)
        const payloadHeader = extractHeader(component._payload)
        if (!(matchHeader && payloadHeader)) {
            return undefined
        }
        // If header content is unchanged, this is a no-op for headers; return undefined
        if (deepEqual(matchHeader.toJSON(), payloadHeader.toJSON())) {
            return undefined
        }
        return new StandardReplace(matchHeader, payloadHeader)
    }
    if (!hasShortName(component)) {
        return undefined
    }

    const minimalJson = {
        tag: component.tag as any,
        key: component.key,
        universalKey: component.universalKey,
        shortName: component.shortName?.toJSON()
    } as any

    const headerComponent = standardComponentFactory(minimalJson)
    return headerComponent ?? undefined
}

export default extractHeader

