/**
 * Component Icon Utilities
 * 
 * Provides utilities for mapping component types to their corresponding Material-UI icons.
 * This ensures consistent icon usage across the application for different component types.
 */

import React from 'react'
import HomeIcon from '@mui/icons-material/Home'
import MapIcon from '@mui/icons-material/Map'
import PersonIcon from '@mui/icons-material/Person'
import FeatureIcon from '@mui/icons-material/Search'
import KnowledgeIcon from '@mui/icons-material/School'
import AssetIcon from '@mui/icons-material/Landscape'
import TextSnippetIcon from '@mui/icons-material/TextSnippet'
import ImageIcon from '@mui/icons-material/Image'
import { ComponentTag } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/abstract'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardMap from '@tonylb/mtw-wml/ts/standardize/components/map'
import StandardCharacter from '@tonylb/mtw-wml/ts/standardize/components/character'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import StandardKnowledge from '@tonylb/mtw-wml/ts/standardize/components/knowledge'
import StandardSituation from '@tonylb/mtw-wml/ts/standardize/components/situation'
import StandardImage from '@tonylb/mtw-wml/ts/standardize/components/image'
import StandardArea from '@tonylb/mtw-wml/ts/standardize/components/area'
import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

export interface ComponentIconOptions {
    fontSize?: string | number
    verticalAlign?: 'middle' | 'baseline' | 'top' | 'bottom'
    marginRight?: string | number
}

/**
 * Gets the Material-UI icon component for a given component tag.
 * 
 * @param tag - The component tag (e.g., 'Room', 'Map', 'Character')
 * @param options - Optional styling options for the icon
 * @returns React element representing the icon, or null if tag is not recognized
 */
export const getComponentIconByTag = (
    tag: ComponentTag | 'Asset' | 'Image' | 'Situation',
    options?: ComponentIconOptions
): React.ReactNode => {
    const iconProps = {
        sx: {
            fontSize: options?.fontSize ?? '1rem',
            verticalAlign: options?.verticalAlign ?? 'middle',
            mr: options?.marginRight ?? 0.5
        }
    }

    switch (tag) {
        case 'Room':
            return <HomeIcon {...iconProps} />
        case 'Map':
            return <MapIcon {...iconProps} />
        case 'Character':
            return <PersonIcon {...iconProps} />
        case 'Feature':
            return <FeatureIcon {...iconProps} />
        case 'Knowledge':
            return <KnowledgeIcon {...iconProps} />
        case 'Situation':
            return <TextSnippetIcon {...iconProps} />
        case 'Image':
            return <ImageIcon {...iconProps} />
        case 'Asset':
            return <AssetIcon {...iconProps} />
        case 'Area':
            return <AssetIcon {...iconProps} />
        default:
            return null
    }
}

/**
 * Gets the Material-UI icon component for a StandardComponent instance.
 * 
 * @param component - The StandardComponent instance
 * @param options - Optional styling options for the icon
 * @returns React element representing the icon, or null if component type is not recognized
 */
export const getComponentIcon = (
    component: StandardComponent | null | undefined,
    options?: ComponentIconOptions
): React.ReactNode => {
    if (!component) {
        return null
    }

    // Determine tag from component instance
    let tag: ComponentTag | 'Asset' | 'Image' | 'Situation' | undefined

    if (component instanceof StandardRoom) {
        tag = 'Room'
    } else if (component instanceof StandardMap) {
        tag = 'Map'
    } else if (component instanceof StandardCharacter) {
        tag = 'Character'
    } else if (component instanceof StandardFeature) {
        tag = 'Feature'
    } else if (component instanceof StandardKnowledge) {
        tag = 'Knowledge'
    } else if (component instanceof StandardSituation) {
        // Situation has no shortName; labels use Marks-summary. Future: shortName could be used for display.
        tag = 'Situation'
    } else if (component instanceof StandardImage) {
        tag = 'Image'
    } else if (component instanceof StandardArea) {
        tag = 'Area'
    } else {
        // Fallback to component.tag if available
        tag = (component as any).tag
    }

    if (!tag) {
        return null
    }

    return getComponentIconByTag(tag, options)
}
