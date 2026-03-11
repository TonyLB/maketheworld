import React, { FunctionComponent, useCallback, useMemo, useState } from "react"
import Box from "@mui/material/Box"
import List from "@mui/material/List"
import ListItem from "@mui/material/ListItem"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemIcon from "@mui/material/ListItemIcon"
import ListItemText from "@mui/material/ListItemText"
import IconButton from "@mui/material/IconButton"
import Typography from "@mui/material/Typography"
import Alert from "@mui/material/Alert"
import { useWorkbenchAsset } from "../foundations/useWorkbenchAsset"
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import LinkIcon from '@mui/icons-material/Link'
import { MakeTheWorldAccordion } from "../../UI"
import StandardRoom from "@tonylb/mtw-wml/ts/standardize/components/room"
import { StandardLens } from "@tonylb/mtw-wml/ts/standardize/components/worldState"
import StandardReference from "@tonylb/mtw-wml/ts/standardize/components/reference"
import { ReferenceList } from "@tonylb/mtw-wml/ts/standardize/keys/referenceList"
import { LensMarkFacetList } from "@tonylb/mtw-wml/ts/standardize/keys/facets/lensMark"
import { StandardLiteral } from "@tonylb/mtw-wml/ts/standardize/literal"
import { StandardRender, PlainClass } from "@tonylb/mtw-wml/ts/standardize/render"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { StandardLiteralEditor } from "../foundations/StandardLiteral"
import { StandardRenderEditor } from "../foundations/StandardRender"
import { ComponentSelectorDialog } from "../foundations/ComponentSelector"
import { LensMarkFacetsEditor } from "../LensMarkFacetsEditor"
import { ComponentUUID } from "@tonylb/mtw-base/ts/schema"
import { v4 as uuidv4 } from 'uuid'
import { RenderTree } from "@tonylb/mtw-base/ts/renderTree"
import { isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree"
import { enforceTypedKey } from '@tonylb/mtw-utilities/ts/types'

type LensEditorProps = {
    RoomId: ComponentUUID
}

const renderTreeToPlainText = (tree: RenderTree): string => {
    if (!tree || tree.length === 0) return ''
    return tree
        .map(item => {
            if (typeof item === 'string') {
                return item
            }
            if (isSchemaString(item.data)) {
                return item.data.value
            }
            if (item.children && item.children.length > 0) {
                return item.children
                    .filter((child): child is string => typeof child === 'string')
                    .join('')
            }
            return ''
        })
        .filter(Boolean)
        .join(' ')
        .trim()
}

export const LensEditor: FunctionComponent<LensEditorProps> = ({ RoomId }) => {
    const { standardForm, updateStandard, readonly } = useWorkbenchAsset()
    const [lensSelectorOpen, setLensSelectorOpen] = useState(false)

    const room = useMemo(() => {
        if (RoomId) {
            const component = standardForm.byUniversalId[RoomId]
            if (component && component instanceof StandardRoom) {
                return component
            }
        }
        return null
    }, [RoomId, standardForm])

    const lensReferences = useMemo(() => room?.lenses.payload || [], [room])
    const lensCount = lensReferences.length

    const singleLens = useMemo(() => {
        if (lensCount !== 1) return null
        const lensRef = lensReferences[0]
        if (!lensRef || !lensRef.universalKey) return null
        const component = standardForm.byUniversalId[lensRef.universalKey]
        if (component && component instanceof StandardLens) {
            return component
        }
        return null
    }, [lensCount, lensReferences, standardForm])

    const multipleLenses = useMemo(() => {
        if (lensCount <= 1) return []
        return lensReferences
            .map(ref => {
                if (!ref.universalKey) return null
                const component = standardForm.byUniversalId[ref.universalKey]
                if (component && component instanceof StandardLens) {
                    return component
                }
                return null
            })
            .filter((lens): lens is StandardLens => lens !== null)
    }, [lensCount, lensReferences, standardForm])

    const createAndAddLens = useCallback(() => {
        if (!room || readonly) return

        const LensKey = enforceTypedKey('LENS')
        const uuid = uuidv4()
        const lensUniversalKey = LensKey(uuid) as ComponentUUID
        updateStandard({
            type: 'update',
            update: (draft: StandardForm) => {
                const base = draft.byUniversalId[RoomId]
                if (base instanceof StandardRoom) {
                    const newLens = new StandardLens({
                        tag: 'Lens',
                        universalKey: lensUniversalKey
                    })
                    draft.byUniversalId[lensUniversalKey] = newLens

                    const lensReference = new StandardReference({
                        universalKey: lensUniversalKey,
                        tag: 'Lens'
                    })
                    base._payload._lenses = base._payload._lenses.assureItem(lensReference)
                }
                return draft
            }
        })
    }, [room, RoomId, standardForm, updateStandard, readonly])

    const addLensReference = useCallback((universalKey: ComponentUUID) => {
        if (!room || readonly) return
        updateStandard({
            type: 'update',
            update: (draft: StandardForm) => {
                const base = draft.byUniversalId[RoomId]
                if (base instanceof StandardRoom) {
                    const lensReference = new StandardReference({
                        universalKey,
                        tag: 'Lens'
                    })
                    base._payload._lenses = base._payload._lenses.assureItem(lensReference)
                }
                return draft
            }
        })
    }, [room, RoomId, updateStandard, readonly])

    const isLensExcluded = useCallback(
        (universalKey: ComponentUUID) =>
            lensReferences.some((ref) => ref.universalKey === universalKey),
        [lensReferences]
    )

    const removeLensReference = useCallback((index: number) => {
        if (!room || readonly) return
        updateStandard({
            type: 'update',
            update: (draft: StandardForm) => {
                const base = draft.byUniversalId[RoomId]
                if (base instanceof StandardRoom) {
                    const newPayload = base._payload._lenses.payload.filter((_, i) => i !== index)
                    base._payload._lenses = new ReferenceList(newPayload)
                }
                return draft
            }
        })
    }, [room, RoomId, updateStandard, readonly])

    //
    // Use stable universalKey-based callbacks and only dispatch when content
    // has actually changed. Empty values are normalized to `undefined` in
    // the stored payload, which is the canonical pattern elsewhere.
    //
    const lensUniversalKey = useMemo(
        () => singleLens?.universalKey ?? null,
        [singleLens?.universalKey]
    )

    const updateLensShortName = useCallback((newShortName: StandardLiteral) => {
        if (!lensUniversalKey || readonly) return

        const newValue = newShortName._payload?.plain?.toJSON() ?? ''
        const currentValue = singleLens?.shortName?._payload?.plain?.toJSON() ?? ''

        // Short-circuit if no effective change
        if (currentValue === newValue || (!currentValue && !newValue)) {
            return
        }
        updateStandard({
            type: 'update',
            update: (draft: StandardForm) => {
                const lens = draft.byUniversalId[lensUniversalKey]
                if (lens && lens instanceof StandardLens) {
                    lens._payload._shortName = newValue ? newShortName : undefined
                }
                return draft
            }
        })
    }, [lensUniversalKey, singleLens?.shortName, updateStandard, readonly])

    const updateLensDescription = useCallback((newDescription: StandardRender) => {
        if (!lensUniversalKey || readonly) return

        const newValue = newDescription.toJSON() ?? []
        const currentValue = singleLens?.description?.toJSON() ?? []

        // Short-circuit if no effective change
        if (JSON.stringify(currentValue) === JSON.stringify(newValue)) {
            return
        }
        updateStandard({
            type: 'update',
            update: (draft: StandardForm) => {
                const lens = draft.byUniversalId[lensUniversalKey]
                if (lens && lens instanceof StandardLens) {
                    const isEmpty = !newValue || (Array.isArray(newValue) && newValue.length === 0)
                    lens._payload._description = isEmpty ? undefined : newDescription
                }
                return draft
            }
        })
    }, [lensUniversalKey, singleLens?.description, updateStandard, readonly])

    const handleLensMarksChange = useCallback(
        (newMarks: LensMarkFacetList) => {
            if (!lensUniversalKey || readonly) return
            updateStandard({
                type: "update",
                update: (draft: StandardForm) => {
                    const lens = draft.byUniversalId[lensUniversalKey]
                    if (lens && lens instanceof StandardLens) {
                        lens._payload._marks = newMarks
                    }
                    return draft
                }
            })
        },
        [lensUniversalKey, updateStandard, readonly]
    )

    if (!room) {
        return (
            <MakeTheWorldAccordion title="Lens" defaultExpanded>
                <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
                    Room not found
                </Box>
            </MakeTheWorldAccordion>
        )
    }

    if (lensCount === 0) {
        return (
            <>
                <MakeTheWorldAccordion title="Lens" defaultExpanded>
                    <List>
                        <ListItem>
                            <ListItemButton
                                onClick={createAndAddLens}
                                disabled={readonly}
                                sx={{ justifyContent: 'center' }}
                            >
                                <ListItemIcon>
                                    <AddIcon />
                                </ListItemIcon>
                                <ListItemText primary="Add Lens" />
                            </ListItemButton>
                        </ListItem>
                        <ListItem>
                            <ListItemButton
                                onClick={() => setLensSelectorOpen(true)}
                                disabled={readonly}
                                sx={{ justifyContent: 'center' }}
                            >
                                <ListItemIcon>
                                    <LinkIcon />
                                </ListItemIcon>
                                <ListItemText primary="Reference existing Lens" />
                            </ListItemButton>
                        </ListItem>
                    </List>
                </MakeTheWorldAccordion>
                <ComponentSelectorDialog
                    open={lensSelectorOpen}
                    onClose={() => setLensSelectorOpen(false)}
                    tag="Lens"
                    onSelect={addLensReference}
                    isExcluded={isLensExcluded}
                />
            </>
        )
    }

    if (lensCount === 1 && singleLens) {
        return (
            <MakeTheWorldAccordion title="Lens" defaultExpanded>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
                    <StandardLiteralEditor
                        value={singleLens.shortName ?? new StandardLiteral('')}
                        onChange={updateLensShortName}
                        label="Short Name"
                        placeholder="Enter lens short name..."
                        size="small"
                        variant="outlined"
                    />

                    <LensMarkFacetsEditor
                        marks={singleLens.marks}
                        onChange={handleLensMarksChange}
                        readonly={readonly}
                    />

                    <StandardRenderEditor
                        title="Description"
                        value={singleLens.description ?? new StandardRender([])}
                        onChange={updateLensDescription}
                        validLinkTags={['Feature', 'Knowledge']}
                        toolbar={true}
                        placeholder="Enter a Description"
                        tag="Description"
                    />
                </Box>
            </MakeTheWorldAccordion>
        )
    }

    return (
        <MakeTheWorldAccordion title="Lens" defaultExpanded>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
                <Alert severity="warning" sx={{ mb: 2 }}>
                    <Typography variant="body2" fontWeight="bold" gutterBottom>
                        Multiple Lenses Detected
                    </Typography>
                    <Typography variant="body2">
                        This room has multiple lenses. Multiple lenses are not currently editable.
                        We recommend removing all but one lens. You can delete lenses below to get down to a single lens for full editing.
                    </Typography>
                </Alert>

                <List>
                    {multipleLenses.map((lens, index) => {
                        const lensRef = lensReferences[index]
                        if (!lensRef) return null

                        const shortName = lens.shortName?._payload?.plain?.toJSON()
                        const shortNameStr = typeof shortName === 'string' ? shortName : 'Untitled Lens'
                        const plain = lens.description?.plain ?? []
                        if (lens.description && lens.description._payload && !(lens.description._payload instanceof PlainClass)) {
                            console.error('Expected PlainClass but got', lens.description._payload.constructor.name, lens.description)
                        }
                        const descriptionText = renderTreeToPlainText(plain)

                        return (
                            <ListItem
                                key={lensRef.universalKey || index}
                                sx={{
                                    border: '1px solid #e0e0e0',
                                    borderRadius: '8px',
                                    marginBottom: '8px',
                                    backgroundColor: 'white'
                                }}
                                secondaryAction={
                                    <IconButton
                                        edge="end"
                                        aria-label="delete lens"
                                        onClick={() => removeLensReference(index)}
                                        disabled={readonly}
                                        color="error"
                                    >
                                        <DeleteIcon />
                                    </IconButton>
                                }
                            >
                                <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 1 }}>
                                    <Typography variant="body1" fontWeight="bold">
                                        {shortNameStr}
                                    </Typography>
                                    {descriptionText && (
                                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                            {descriptionText}
                                        </Typography>
                                    )}
                                </Box>
                            </ListItem>
                        )
                    })}
                </List>
            </Box>
        </MakeTheWorldAccordion>
    )
}

export default LensEditor
