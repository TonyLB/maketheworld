import React, { FunctionComponent, useCallback, useMemo, useState } from "react"
import { Box } from "@mui/material"
import FeatureIcon from "@mui/icons-material/Search"

import { useWorkbenchAsset } from "./foundations/useWorkbenchAsset"
import { WorkbenchReferenceList, referenceListToWorkbenchItems } from "./foundations/ReferenceList"
import StandardRoom from "@tonylb/mtw-wml/ts/standardize/components/room"
import StandardFeature from "@tonylb/mtw-wml/ts/standardize/components/feature"
import StandardReference from "@tonylb/mtw-wml/ts/standardize/components/reference"
import { ReferenceList } from "@tonylb/mtw-wml/ts/standardize/keys/referenceList"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { ComponentUUID } from "@tonylb/mtw-base/ts/schema"
import { enforceTypedKey } from "@tonylb/mtw-utilities/ts/types"
import { v4 as uuidv4 } from "uuid"
import { useDispatch } from "react-redux"
import { navigateToComponent } from "../../slices/UI/workbench"
import WorkbenchFeatureSelectorDialog from "./FeatureSelectorDialog"

type RoomFeatureEditorProps = {
    RoomId: ComponentUUID
}

export const WorkbenchRoomFeatureEditor: FunctionComponent<RoomFeatureEditorProps> = ({ RoomId }) => {
    const { standardForm, updateStandard, readonly } = useWorkbenchAsset()
    const dispatch = useDispatch()
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

    const featureReferences = useMemo(
        () => room?.features ?? new ReferenceList([]),
        [room]
    )

    const items = useMemo(
        () =>
            referenceListToWorkbenchItems({
                referenceList: featureReferences,
                standardForm,
                tag: "Feature"
            }).map((item) => ({
                ...item,
                icon: <FeatureIcon sx={{ fontSize: "1.1rem" }} />
            })),
        [featureReferences, standardForm]
    )

    const summary = useMemo(() => {
        if (!items.length) {
            return undefined
        }
        const titles = items.map(({ title }) => title).filter(Boolean)
        return titles.join(", ")
    }, [items])

    const handleAddClick = useCallback(() => {
        if (!readonly) {
            setDialogOpen(true)
        }
    }, [readonly])

    const handleSelectExisting = useCallback(
        (universalKey: ComponentUUID) => {
            if (!room || readonly) {
                return
            }
            updateStandard({
                type: "update",
                update: (draft: StandardForm) => {
                    const base = draft.byUniversalId[RoomId]
                    if (base instanceof StandardRoom) {
                        const reference = new StandardReference({
                            universalKey,
                            tag: "Feature"
                        })
                        base._payload._features = base._payload._features.assureItem(reference)
                    }
                    return draft
                }
            })
        },
        [RoomId, room, updateStandard, readonly]
    )

    const handleCreateNew = useCallback(() => {
        if (!room || readonly) {
            return
        }

        const FeatureKey = enforceTypedKey("FEATURE")
        const uuid = uuidv4()
        const featureUniversalKey = FeatureKey(uuid) as ComponentUUID

        updateStandard({
            type: "update",
            update: (draft: StandardForm) => {
                const base = draft.byUniversalId[RoomId]
                if (base instanceof StandardRoom) {
                    const newFeature = new StandardFeature({
                        tag: "Feature",
                        universalKey: featureUniversalKey
                    })
                    draft.byUniversalId[featureUniversalKey] = newFeature

                    const featureReference = new StandardReference({
                        universalKey: featureUniversalKey,
                        tag: "Feature"
                    })
                    base._payload._features = base._payload._features.assureItem(featureReference)
                }
                return draft
            }
        })
    }, [RoomId, room, updateStandard, readonly])

    const handleRemove = useCallback(
        (id: string) => {
            if (!room || readonly) {
                return
            }
            updateStandard({
                type: "update",
                update: (draft: StandardForm) => {
                    const base = draft.byUniversalId[RoomId]
                    if (base instanceof StandardRoom) {
                        const newPayload = base._payload._features.payload.filter((ref) => {
                            const universalKey = ref.universalKey
                            const key = ref.standardKey.key
                            const resolvedId = universalKey ?? key
                            return resolvedId !== id
                        })
                        base._payload._features = new ReferenceList(newPayload)
                    }
                    return draft
                }
            })
        },
        [RoomId, room, updateStandard, readonly]
    )

    const handleItemClick = useCallback(
        (id: string) => {
            if (readonly) {
                return
            }
            dispatch(navigateToComponent(id as ComponentUUID))
        },
        [dispatch, readonly]
    )

    if (!room) {
        return (
            <Box sx={{ marginTop: "0.5em" }}>
                <WorkbenchReferenceList
                    title="Features"
                    items={[]}
                    defaultExpanded
                    disabled
                    emptyStateText="Room not found"
                />
            </Box>
        )
    }

    return (
        <Box sx={{ marginTop: "0.5em" }}>
            <WorkbenchReferenceList
                title="Features"
                items={items}
                summary={summary}
                defaultExpanded={!!items.length}
                disabled={readonly}
                onItemClick={handleItemClick}
                onItemRemove={handleRemove}
                onAddClick={handleAddClick}
                addLabel="Add Feature"
                emptyStateText="This room does not currently reference any features."
            />
            <WorkbenchFeatureSelectorDialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                onSelectExisting={handleSelectExisting}
                onCreateNew={handleCreateNew}
            />
        </Box>
    )
}

export default WorkbenchRoomFeatureEditor

