import { useMemo } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { enforceTypedKey } from '@tonylb/mtw-utilities/ts/types'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'

type ComponentTag = 'ROOM' | 'FEATURE' | 'KNOWLEDGE' | 'CHARACTER' | 'MAP' | 'IMAGE'

/**
 * Hook to construct a ComponentUUID from the ComponentId route parameter and a known tag.
 * 
 * @param tag - The component tag (e.g., 'CHARACTER', 'ROOM')
 * @returns The constructed ComponentUUID, or undefined if ComponentId is missing
 * 
 * @example
 * ```tsx
 * const universalKey = useUniversalKey('CHARACTER')
 * ```
 */
export const useUniversalKey = (tag: ComponentTag): ComponentUUID | undefined => {
    const { ComponentId } = useParams<{ ComponentId: string }>()
    
    return useMemo(() => {
        if (!ComponentId) {
            return undefined
        }
        const enforceKey = enforceTypedKey(tag)
        return enforceKey(ComponentId) as ComponentUUID
    }, [ComponentId, tag])
}

/**
 * Hook to construct a ComponentUUID from the ComponentId route parameter,
 * extracting the tag from the URL path.
 * 
 * @returns The constructed ComponentUUID, or undefined if ComponentId or tag is missing
 * 
 * @example
 * ```tsx
 * const universalKey = useUniversalKeyFromPath()
 * // Works with URLs like: /Library/Edit/Asset/testAsset/Room/abc-123
 * // Extracts 'Room' from path and converts to 'ROOM'
 * ```
 */
export const useUniversalKeyFromPath = (): ComponentUUID | undefined => {
    const { ComponentId } = useParams<{ ComponentId: string }>()
    const location = useLocation()
    const tag = location.pathname.split('/').slice(-2)[0]
    
    return useMemo(() => {
        if (!ComponentId || !tag) {
            return undefined
        }
        const tagUpper = tag.toUpperCase() as ComponentTag
        const enforceKey = enforceTypedKey(tagUpper)
        return enforceKey(ComponentId) as ComponentUUID
    }, [ComponentId, tag])
}
