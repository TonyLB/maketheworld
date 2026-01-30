import React, { FunctionComponent, useMemo } from "react"
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
    Divider
} from "@mui/material"
import CloseIcon from "@mui/icons-material/Close"
import AddIcon from "@mui/icons-material/Add"

import { useWorkbenchAsset } from "./foundations/useWorkbenchAsset"
import StandardFeature from "@tonylb/mtw-wml/ts/standardize/components/feature"
import { ComponentUUID } from "@tonylb/mtw-base/ts/schema"

interface FeatureSelectorDialogProps {
    open: boolean
    onClose: () => void
    onSelectExisting: (universalKey: ComponentUUID) => void
    onCreateNew: () => void
}

const FeatureChoicesSubsection: FunctionComponent<{
    features: Array<{ key: string | undefined; universalKey: ComponentUUID | undefined; shortName?: string }>
    onSelect: (universalKey: ComponentUUID) => void
    onClose: () => void
}> = ({ features, onSelect, onClose }) => {
    if (!features.length) {
        return null
    }

    return (
        <>
            <ListSubheader>Existing Features</ListSubheader>
            {features.map(({ key, universalKey, shortName }) => {
                if (!universalKey) {
                    return null
                }
                const displayName = shortName || key || "Untitled Feature"
                return (
                    <ListItemButton
                        key={universalKey}
                        onClick={() => {
                            onSelect(universalKey)
                            onClose()
                        }}
                    >
                        <ListItemText primary={displayName} secondary={universalKey} />
                    </ListItemButton>
                )
            })}
        </>
    )
}

export const WorkbenchFeatureSelectorDialog: FunctionComponent<FeatureSelectorDialogProps> = ({
    open,
    onClose,
    onSelectExisting,
    onCreateNew
}) => {
    const { standardForm } = useWorkbenchAsset()

    const features = useMemo(
        () =>
            Object.values(standardForm.byId)
                .filter((component): component is StandardFeature => component instanceof StandardFeature)
                .map((feature) => {
                    const shortName = feature.shortName?._payload?.plain?.toJSON()
                    const shortNameStr = typeof shortName === "string" ? shortName : undefined
                    return {
                        key: feature.key,
                        universalKey: feature.universalKey,
                        shortName: shortNameStr
                    }
                })
                .filter(({ universalKey }) => universalKey !== undefined),
        [standardForm]
    )

    const handleCreateNew = () => {
        onCreateNew()
        onClose()
    }

    return (
        <Dialog open={open} scroll="paper" onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                <Box
                    sx={{
                        marginRight: "2rem",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                    }}
                >
                    <span>Select or Create Feature</span>
                    <IconButton
                        aria-label="close"
                        onClick={onClose}
                        sx={{
                            position: "absolute",
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
                    <FeatureChoicesSubsection
                        features={features}
                        onSelect={onSelectExisting}
                        onClose={onClose}
                    />
                    <Divider sx={{ my: 2 }} />
                    <ListItemButton
                        onClick={handleCreateNew}
                        sx={{
                            border: "1px dashed #ccc",
                            borderRadius: "4px",
                            marginTop: "0.5em"
                        }}
                    >
                        <ListItemText
                            primary={
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                    <AddIcon />
                                    <span>Create New Feature</span>
                                </Box>
                            }
                            secondary="Create a new feature component for this room"
                        />
                    </ListItemButton>
                </List>
            </DialogContent>
        </Dialog>
    )
}

export default WorkbenchFeatureSelectorDialog

