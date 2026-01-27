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
import { useWorkbenchAsset } from "./useWorkbenchAsset"
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import { MakeTheWorldAccordion } from "../UI"
import StandardRoom from "@tonylb/mtw-wml/ts/standardize/components/room"
import StandardMark, { StandardLens } from "@tonylb/mtw-wml/ts/standardize/components/worldState"
import StandardReference from "@tonylb/mtw-wml/ts/standardize/components/reference"
import { ReferenceList } from "@tonylb/mtw-wml/ts/standardize/keys/referenceList"
import { StandardLiteral } from "@tonylb/mtw-wml/ts/standardize/literal"
import { StandardRender, PlainClass } from "@tonylb/mtw-wml/ts/standardize/render"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import WorkbenchStandardLiteralEditor from "./StandardLiteralEditor"
import WorkbenchStandardRenderEditor from "./StandardRenderEditor"
import WorkbenchTitledBox from "./WorkbenchTitledBox"
import WorkbenchLensSelectorDialog from "./LensSelectorDialog"
import { useDebouncedOnChange } from "../../hooks/useDebounce"
import { ComponentUUID } from "@tonylb/mtw-base/ts/schema"
import { v4 as uuidv4 } from 'uuid'
import { RenderTree } from "@tonylb/mtw-base/ts/renderTree"
import { isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree"
import { enforceTypedKey } from '@tonylb/mtw-utilities/ts/types'

type RoomLensEditorProps = {
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

const MarkListItem: FunctionComponent<{
    mark: StandardMark
    onDelete: () => void
    disabled?: boolean
}> = ({ mark, onDelete, disabled }) => {
    const { readonly } = useWorkbenchAsset()
    const isDisabled = readonly || disabled

    const shortName = useMemo(() => {
        const shortNameData = mark.shortName?._payload?.plain?.toJSON()
        return typeof shortNameData === 'string' ? shortNameData : 'Untitled Mark'
    }, [mark.shortName])

    const descriptionText = useMemo(() => {
        const plain = mark.description?.plain ?? []
        if (mark.description && mark.description._payload && !(mark.description._payload instanceof PlainClass)) {
            console.error('Expected PlainClass but got', mark.description._payload.constructor.name, mark.description)
        }
        return renderTreeToPlainText(plain)
    }, [mark.description])

    return (
        <ListItem
            sx={{
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                marginBottom: '8px',
                backgroundColor: 'white'
            }}
            secondaryAction={
                <IconButton
                    edge="end"
                    aria-label="delete mark"
                    onClick={onDelete}
                    disabled={isDisabled}
                    color="error"
                    size="small"
                >
                    <DeleteIcon />
                </IconButton>
            }
        >
            <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 1 }}>
                <Typography variant="body2" fontWeight="bold">
                    {shortName}
                </Typography>
                {descriptionText && (
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        {descriptionText}
                    </Typography>
                )}
            </Box>
        </ListItem>
    )
}

export const WorkbenchRoomLensEditor: FunctionComponent<RoomLensEditorProps> = ({ RoomId }) => {
    const { standardForm, updateStandard, readonly } = useWorkbenchAsset()
    const [dialogOpen, setDialogOpen] = useState(false)

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

    const updateLensShortName = useCallback((newShortName: StandardLiteral) => {
        if (!singleLens || readonly || !singleLens.universalKey) return

        updateStandard({
            type: 'update',
            update: (draft: StandardForm) => {
                const lens = draft.byUniversalId[singleLens.universalKey!]
                if (lens && lens instanceof StandardLens) {
                    lens._payload._shortName = newShortName
                }
                return draft
            }
        })
    }, [singleLens, updateStandard, readonly])

    const updateLensDescription = useCallback((newDescription: StandardRender) => {
        if (!singleLens || readonly || !singleLens.universalKey) return

        updateStandard({
            type: 'update',
            update: (draft: StandardForm) => {
                const lens = draft.byUniversalId[singleLens.universalKey!]
                if (lens && lens instanceof StandardLens) {
                    lens._payload._description = newDescription
                }
                return draft
            }
        })
    }, [singleLens, updateStandard, readonly])

    const addMarkToLens = useCallback(() => {
        if (!singleLens || readonly || !singleLens.universalKey) return

        const MarkKey = enforceTypedKey('MARK')
        const uuid = uuidv4()
        const markUniversalKey = MarkKey(uuid) as ComponentUUID

        updateStandard({
            type: 'update',
            update: (draft: StandardForm) => {
                const lens = draft.byUniversalId[singleLens.universalKey!]
                if (lens && lens instanceof StandardLens) {
                    const newMark = new StandardMark({
                        tag: 'Mark',
                        universalKey: markUniversalKey
                    })
                    draft.byUniversalId[markUniversalKey] = newMark

                    const markReference = new StandardReference({
                        universalKey: markUniversalKey,
                        tag: 'Mark'
                    })
                    lens._payload._marks = lens._payload._marks.assureItem(markReference)
                }
                return draft
            }
        })
    }, [singleLens, standardForm, updateStandard, readonly])

    const removeMarkFromLens = useCallback((index: number) => {
        if (!singleLens || readonly || !singleLens.universalKey) return

        updateStandard({
            type: 'update',
            update: (draft: StandardForm) => {
                const lens = draft.byUniversalId[singleLens.universalKey!]
                if (lens && lens instanceof StandardLens) {
                    const newPayload = lens._payload._marks.payload.filter((_, i) => i !== index)
                    lens._payload._marks = new ReferenceList(newPayload)
                }
                return draft
            }
        })
    }, [singleLens, updateStandard, readonly])

    const marks = useMemo(() => {
        if (!singleLens) return []
        return singleLens.marks.payload
            .map(ref => {
                if (!ref.universalKey) return null
                const component = standardForm.byUniversalId[ref.universalKey]
                if (component && component instanceof StandardMark) {
                    return component
                }
                return null
            })
            .filter((mark): mark is StandardMark => mark !== null)
    }, [singleLens, standardForm])

    const [lensShortName, setLensShortName] = useState<StandardLiteral>(
        singleLens?.shortName ?? new StandardLiteral('')
    )
    const [lensDescription, setLensDescription] = useState<StandardRender>(
        singleLens?.description ?? new StandardRender([])
    )

    React.useEffect(() => {
        if (singleLens) {
            setLensShortName(singleLens.shortName ?? new StandardLiteral(''))
            setLensDescription(singleLens.description ?? new StandardRender([]))
        }
    }, [singleLens])

    useDebouncedOnChange({
        value: lensShortName,
        delay: 1000,
        onChange: updateLensShortName
    })

    useDebouncedOnChange({
        value: lensDescription,
        delay: 1000,
        onChange: updateLensDescription
    })

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
                                onClick={() => setDialogOpen(true)}
                                disabled={readonly}
                                sx={{ justifyContent: 'center' }}
                            >
                                <ListItemIcon>
                                    <AddIcon />
                                </ListItemIcon>
                                <ListItemText primary="Add Lens" />
                            </ListItemButton>
                        </ListItem>
                    </List>
                </MakeTheWorldAccordion>
                <WorkbenchLensSelectorDialog
                    open={dialogOpen}
                    onClose={() => setDialogOpen(false)}
                    onSelectExisting={addLensReference}
                    onCreateNew={createAndAddLens}
                />
            </>
        )
    }

    if (lensCount === 1 && singleLens) {
        return (
            <MakeTheWorldAccordion title="Lens" defaultExpanded>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
                    <WorkbenchTitledBox title="Short Name">
                        <WorkbenchStandardLiteralEditor
                            value={lensShortName}
                            onChange={setLensShortName}
                            placeholder="Enter lens short name..."
                            size="small"
                        />
                    </WorkbenchTitledBox>

                    <WorkbenchTitledBox title="Description">
                        <WorkbenchStandardRenderEditor
                            value={lensDescription}
                            onChange={setLensDescription}
                            validLinkTags={[]}
                            toolbar={true}
                        />
                    </WorkbenchTitledBox>

                    <WorkbenchTitledBox title="Marks">
                        <List>
                            {marks.map((mark, index) => {
                                const markRef = singleLens.marks.payload[index]
                                if (!markRef) return null
                                return (
                                    <MarkListItem
                                        key={markRef.universalKey || index}
                                        mark={mark}
                                        onDelete={() => removeMarkFromLens(index)}
                                        disabled={readonly}
                                    />
                                )
                            })}
                            <ListItem>
                                <ListItemButton
                                    onClick={addMarkToLens}
                                    disabled={readonly}
                                    sx={{ justifyContent: 'center' }}
                                >
                                    <ListItemIcon>
                                        <AddIcon />
                                    </ListItemIcon>
                                    <ListItemText primary="Add Mark" />
                                </ListItemButton>
                            </ListItem>
                        </List>
                    </WorkbenchTitledBox>
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

export default WorkbenchRoomLensEditor
