import React, { FunctionComponent, useMemo } from 'react'
import {
    Box,
    Dialog,
    DialogTitle,
    DialogContent,
    List,
    ListItemButton,
    ListItemText,
    ListSubheader,
    IconButton,
    Typography
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'

import { useWorkbenchAsset } from '../useWorkbenchAsset'
import { getComponentIconByTag } from '../../../../lib/componentIcons'
import type { ComponentTag } from '../ReferenceList/ReferenceListEditor'

import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import StandardKnowledge from '@tonylb/mtw-wml/ts/standardize/components/knowledge'
import StandardMap from '@tonylb/mtw-wml/ts/standardize/components/map'
import StandardCharacter from '@tonylb/mtw-wml/ts/standardize/components/character'
import StandardImage from '@tonylb/mtw-wml/ts/standardize/components/image'
import StandardSituation from '@tonylb/mtw-wml/ts/standardize/components/situation'
import { StandardLens, StandardMark } from '@tonylb/mtw-wml/ts/standardize/components/worldState'
import StandardMessage from '@tonylb/mtw-wml/ts/standardize/components/message'
import { situationToMarksSummary } from '../../../../lib/situationLabel'
import type { StandardForm } from '@tonylb/mtw-wml/ts/standardize'

/** ComponentTag plus Image (supported in selector). */
type DialogComponentTag = ComponentTag | 'Image'

const SECTION_ORDER: DialogComponentTag[] = [
    'Room',
    'Feature',
    'Knowledge',
    'Map',
    'Character',
    'Image',
    'Lens',
    'Situation',
    'Mark',
    'Message'
]

function componentToTag(component: StandardComponent): DialogComponentTag | null {
    if (component instanceof StandardRoom) return 'Room'
    if (component instanceof StandardFeature) return 'Feature'
    if (component instanceof StandardKnowledge) return 'Knowledge'
    if (component instanceof StandardMap) return 'Map'
    if (component instanceof StandardCharacter) return 'Character'
    if (component instanceof StandardImage) return 'Image'
    if (component instanceof StandardLens) return 'Lens'
    if (component instanceof StandardMark) return 'Mark'
    if (component instanceof StandardMessage) return 'Message'
    if (component instanceof StandardSituation) return 'Situation'
    return null
}

function getDisplayName(component: StandardComponent, standardForm?: StandardForm | null): string {
    if (component instanceof StandardSituation) {
        // Future: if Situation had shortName, prefer it here with Marks-summary as fallback.
        return situationToMarksSummary(component, standardForm ?? null)
    }
    const plain = (component as { shortName?: { _payload?: { plain?: { toJSON?: () => unknown } } } }).shortName?._payload?.plain
    const shortName = plain?.toJSON?.()
    const str = typeof shortName === 'string' ? shortName : undefined
    if (str?.trim()) return str
    if (component.key) return component.key
    return 'Untitled'
}

export interface ComponentSelectorDialogProps {
    open: boolean
    onClose: () => void
    /** When set: filter to this tag only, flat list, no section headers. When absent: all types, grouped by type with headers. */
    tag?: DialogComponentTag
    onSelect: (universalKey: ComponentUUID) => void
    /** When true for a component, that component is omitted from the list (e.g. already in the reference list). */
    isExcluded?: (universalKey: ComponentUUID) => boolean
}

type ListItem = {
    universalKey: ComponentUUID
    displayName: string
    /** Human-readable key for secondary display; only set when we have one (never show universalKey). */
    secondaryKey?: string
    tag: DialogComponentTag
}

export const ComponentSelectorDialog: FunctionComponent<ComponentSelectorDialogProps> = ({
    open,
    onClose,
    tag,
    onSelect,
    isExcluded
}) => {
    const { standardForm } = useWorkbenchAsset()

    const { flat, grouped } = useMemo(() => {
        const components = standardForm.components.filter(
            (c): c is StandardComponent & { universalKey: ComponentUUID } =>
                !!c?.universalKey && !(isExcluded?.(c.universalKey as ComponentUUID) ?? false)
        )
        const withMeta: ListItem[] = components
            .map((c) => {
                const componentTag = componentToTag(c)
                if (tag != null && componentTag !== tag) return null
                const localKey = c.key
                const secondaryKey =
                    typeof localKey === 'string' && localKey.trim() ? localKey : undefined
                return {
                    universalKey: c.universalKey as ComponentUUID,
                    displayName: getDisplayName(c, standardForm),
                    secondaryKey,
                    tag: componentTag!
                } as ListItem | null
            })
            .filter((item): item is ListItem => item != null && item.tag != null)

        if (tag != null) {
            return { flat: withMeta, grouped: null }
        }
        const byTag = new Map<DialogComponentTag, ListItem[]>()
        for (const item of withMeta) {
            const list = byTag.get(item.tag) ?? []
            list.push(item)
            byTag.set(item.tag, list)
        }
        const groupedList: { tag: DialogComponentTag; items: ListItem[] }[] = SECTION_ORDER.filter((t) => byTag.has(t)).map((t) => ({
            tag: t,
            items: byTag.get(t)!
        }))
        return { flat: null, grouped: groupedList }
    }, [standardForm, tag, isExcluded])

    const isEmpty = flat ? flat.length === 0 : grouped?.every((g) => g.items.length === 0) ?? true

    const handleSelect = (universalKey: ComponentUUID) => {
        onSelect(universalKey)
        onClose()
    }

    return (
        <Dialog open={open} scroll="paper" onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                <Box sx={{ marginRight: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{tag != null ? `Select ${tag}` : 'Select component'}</span>
                    <IconButton
                        aria-label="close"
                        onClick={onClose}
                        sx={{
                            position: 'absolute',
                            right: 8,
                            top: 8
                        }}
                    >
                        <CloseIcon />
                    </IconButton>
                </Box>
            </DialogTitle>
            <DialogContent>
                <List>
                    {isEmpty && (
                        <Typography variant="body2" color="text.secondary" sx={{ py: 2, px: 2 }}>
                            No components to show.
                        </Typography>
                    )}
                    {flat != null &&
                        flat.map((item) => (
                            <ListItemButton
                                key={item.universalKey}
                                onClick={() => handleSelect(item.universalKey)}
                            >
                                <ListItemText primary={item.displayName} secondary={item.secondaryKey} />
                            </ListItemButton>
                        ))}
                    {grouped != null &&
                        grouped.map(({ tag: sectionTag, items }) => (
                            <React.Fragment key={sectionTag}>
                                <ListSubheader>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        {getComponentIconByTag(sectionTag, { fontSize: '1rem' })}
                                        <span>Existing {sectionTag}s</span>
                                    </Box>
                                </ListSubheader>
                                {items.map((item) => (
                                    <ListItemButton
                                        key={item.universalKey}
                                        onClick={() => handleSelect(item.universalKey)}
                                    >
                                        <ListItemText primary={item.displayName} secondary={item.secondaryKey} />
                                    </ListItemButton>
                                ))}
                            </React.Fragment>
                        ))}
                </List>
            </DialogContent>
        </Dialog>
    )
}

export default ComponentSelectorDialog
