import React, { FunctionComponent, useMemo, useCallback, useState } from "react"
import { Box, Button, IconButton, Typography, useTheme } from "@mui/material"
import { alpha } from "@mui/material"
import AddIcon from "@mui/icons-material/Add"
import ExpandMoreIcon from "@mui/icons-material/ExpandMore"
import ExpandLessIcon from "@mui/icons-material/ExpandLess"
import ImportExportIcon from "@mui/icons-material/ImportExport"
import LinkIcon from "@mui/icons-material/Link"
import FeatureIcon from "@mui/icons-material/Search"
import KnowledgeIcon from "@mui/icons-material/School"
import MapIcon from "@mui/icons-material/Map"
import PersonIcon from "@mui/icons-material/Person"
import HomeIcon from "@mui/icons-material/Home"
import ImageIcon from "@mui/icons-material/Image"
import TextSnippetIcon from "@mui/icons-material/TextSnippet"
import CallMadeIcon from "@mui/icons-material/CallMade"

import { useWorkbenchAsset } from "../useWorkbenchAsset"
import { useDispatch } from "react-redux"
import { addOnboardingComplete } from "../../../../slices/player/index.api"
import { addImportToDraft, getTopLevelAddToReferenceList } from "../../../../slices/personalAssets"
import { navigateToComponent } from "../../../../slices/UI/workbench"
import { ReferenceListEditorGeneric } from "./ReferenceListEditorGeneric"
import { referenceListToItems } from "./referenceListAdapter"
import ImportComponentDialog from "../../ImportComponentDialog"
import { ComponentSelectorDialog } from "../ComponentSelector"
import ImageHeader from "../../ImageHeader"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { ReferenceList } from "@tonylb/mtw-wml/ts/standardize/keys/referenceList"
import StandardReference from "@tonylb/mtw-wml/ts/standardize/components/reference"
import StandardCharacter from "@tonylb/mtw-wml/ts/standardize/components/character"
import StandardRoom from "@tonylb/mtw-wml/ts/standardize/components/room"
import StandardFeature from "@tonylb/mtw-wml/ts/standardize/components/feature"
import StandardKnowledge from "@tonylb/mtw-wml/ts/standardize/components/knowledge"
import StandardMap from "@tonylb/mtw-wml/ts/standardize/components/map"
import StandardImage from "@tonylb/mtw-wml/ts/standardize/components/image"
import { StandardComponent } from "@tonylb/mtw-wml/ts/standardize/components/baseClasses"
import { standardComponentFactory } from "@tonylb/mtw-wml/ts/standardize/componentFactory"
import { enforceTypedKey } from "@tonylb/mtw-utilities/ts/types"
import { v4 as uuidv4 } from "uuid"
import { AssetUUID, ComponentUUID } from "@tonylb/mtw-base/ts/schema"
import type { SchemaImportMapping } from "@tonylb/mtw-base/ts/schema/metaData"

type AddComponentTag = "Character" | "Map" | "Room" | "Feature" | "Knowledge" | "Image" | "Situation"

const ADD_OPTIONS: { tag: AddComponentTag; icon: React.ReactNode; label: string }[] = [
    { tag: "Character", icon: <PersonIcon sx={{ fontSize: "1rem" }} />, label: "Character" },
    { tag: "Map", icon: <MapIcon sx={{ fontSize: "1rem" }} />, label: "Map" },
    { tag: "Room", icon: <HomeIcon sx={{ fontSize: "1rem" }} />, label: "Room" },
    { tag: "Feature", icon: <FeatureIcon sx={{ fontSize: "1rem" }} />, label: "Feature" },
    { tag: "Knowledge", icon: <KnowledgeIcon sx={{ fontSize: "1rem" }} />, label: "Knowledge" },
    { tag: "Image", icon: <ImageIcon sx={{ fontSize: "1rem" }} />, label: "Image" },
    { tag: "Situation", icon: <TextSnippetIcon sx={{ fontSize: "1rem" }} />, label: "Situation" }
]

const TAG_ICONS: Record<string, React.ReactNode> = {
    Character: <PersonIcon sx={{ fontSize: "1.25rem" }} />,
    Map: <MapIcon sx={{ fontSize: "1.25rem" }} />,
    Room: <HomeIcon sx={{ fontSize: "1.25rem" }} />,
    Feature: <FeatureIcon sx={{ fontSize: "1.25rem" }} />,
    Knowledge: <KnowledgeIcon sx={{ fontSize: "1.25rem" }} />,
    Image: <ImageIcon sx={{ fontSize: "1.25rem" }} />,
    Situation: <TextSnippetIcon sx={{ fontSize: "1.25rem" }} />
}

export interface TopLevelEditorProps {
    title?: string
    defaultExpanded?: boolean
}

export const TopLevelEditor: FunctionComponent<TopLevelEditorProps> = ({
    title = "Components",
    defaultExpanded = true
}) => {
    const theme = useTheme()
    const dispatch = useDispatch()
    const { standardForm, updateStandard, readonly, AssetId, inheritedStandardForm } = useWorkbenchAsset()
    const [addExpanded, setAddExpanded] = useState(false)
    const [importDialogOpen, setImportDialogOpen] = useState(false)
    const [referenceExistingOpen, setReferenceExistingOpen] = useState(false)

    const referenceList = useMemo(
        () => standardForm._topLevel ?? new ReferenceList([]),
        [standardForm._topLevel]
    )

    const topLevelComponents = useMemo<StandardComponent[]>(() => {
        if (!standardForm._topLevel) return []
        return standardForm._topLevel.payload
            .map((ref) => standardForm._lookup(ref.standardKey.toJSON()))
            .filter((c): c is StandardComponent => c !== undefined)
    }, [standardForm])

    const images = useMemo(
        () => topLevelComponents.filter((c): c is StandardImage => c instanceof StandardImage),
        [topLevelComponents]
    )

    const nonImageComponents = useMemo(
        () => topLevelComponents.filter((c) => !(c instanceof StandardImage)),
        [topLevelComponents]
    )

    const items = useMemo(() => {
        const baseItems = referenceListToItems({
            referenceList,
            standardForm,
            tag: undefined
        }).filter((item) => {
            const comp = standardForm.byUniversalId[item.id as ComponentUUID] as StandardComponent | undefined
            return !(comp instanceof StandardImage)
        })
        return baseItems.map((item) => {
            const comp = standardForm.byUniversalId[item.id as ComponentUUID] as StandardComponent | undefined
            const tag = comp?.tag
            const icon = tag ? TAG_ICONS[tag] : undefined
            const isImported =
                Boolean(inheritedStandardForm.byUniversalId[item.id as ComponentUUID]) || Boolean(comp?._from)
            return {
                ...item,
                icon: (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        {icon}
                        {isImported && (
                            <CallMadeIcon sx={{ fontSize: "0.875rem", opacity: 0.7 }} />
                        )}
                    </Box>
                )
            }
        })
    }, [referenceList, standardForm, inheritedStandardForm])

    const summary = useMemo(() => {
        if (!items.length) return undefined
        return items.map(({ title: t }) => t).filter(Boolean).join(", ")
    }, [items])

    const handleItemRemove = useCallback(
        (id: string) => {
            if (readonly) return
            updateStandard({ type: "removeComponent", componentKey: id })
        },
        [updateStandard, readonly]
    )

    const handleItemClick = useCallback(
        (id: string) => {
            dispatch(navigateToComponent(id as ComponentUUID))
        },
        [dispatch]
    )

    const addAsset = useCallback(
        (tag: AddComponentTag) => () => {
            if (tag === "Room") {
                dispatch(addOnboardingComplete(["addRoom"]))
            }
            updateStandard({
                type: "update",
                update: (draft: StandardForm) => {
                    const tagUpper = tag.toUpperCase() as
                        | "ROOM"
                        | "FEATURE"
                        | "KNOWLEDGE"
                        | "CHARACTER"
                        | "MAP"
                        | "IMAGE"
                        | "SITUATION"
                    const enforceKey = enforceTypedKey(tagUpper)
                    const uuid = uuidv4()
                    const universalKey = enforceKey(uuid) as ComponentUUID

                    const { component } = standardComponentFactory({ tag, universalKey })
                    if (component) {
                        draft.byUniversalId[universalKey] = component
                        const componentReference = new StandardReference({
                            universalKey,
                            tag
                        })
                        if (draft._topLevel) {
                            draft._topLevel = draft._topLevel.assureItem(componentReference)
                        } else {
                            draft._topLevel = new ReferenceList([componentReference])
                        }
                    } else {
                        throw new Error(`Invalid tag: ${tag}`)
                    }
                    return draft
                }
            })
            setAddExpanded(false)
        },
        [updateStandard, dispatch]
    )

    const handleImportSelect = useCallback(
        (fromAsset: AssetUUID, uuid: ComponentUUID, tag: SchemaImportMapping["type"]) => {
            updateStandard({
                type: "update",
                update: (draft) => {
                    const ref = addImportToDraft(draft, { fromAsset, uuid, tag })
                    const descriptor = getTopLevelAddToReferenceList(draft)
                    if (ref && descriptor) descriptor.setReferenceList(descriptor.referenceList.assureItem(ref))
                    return draft
                }
            })
            setImportDialogOpen(false)
        },
        [updateStandard]
    )

    const isTopLevelExcluded = useCallback(
        (universalKey: ComponentUUID) => {
            if (referenceList.payload.some((ref) => ref.universalKey === universalKey)) return true
            const comp = standardForm.byUniversalId[universalKey] as StandardComponent | undefined
            if (!comp) return true
            return !(
                comp instanceof StandardRoom ||
                comp instanceof StandardFeature ||
                comp instanceof StandardKnowledge ||
                comp instanceof StandardMap ||
                comp instanceof StandardCharacter ||
                comp instanceof StandardImage
            )
        },
        [referenceList, standardForm]
    )

    const handleReferenceExistingSelect = useCallback(
        (universalKey: ComponentUUID) => {
            if (readonly) return
            const comp = standardForm.byUniversalId[universalKey] as StandardComponent | undefined
            if (!comp) return
            const tag = comp.tag as AddComponentTag
            if (
                !(
                    comp instanceof StandardRoom ||
                    comp instanceof StandardFeature ||
                    comp instanceof StandardKnowledge ||
                    comp instanceof StandardMap ||
                    comp instanceof StandardCharacter ||
                    comp instanceof StandardImage
                )
            ) {
                return
            }
            updateStandard({
                type: "update",
                update: (draft: StandardForm) => {
                    const ref = new StandardReference({ universalKey, tag })
                    if (draft._topLevel) {
                        draft._topLevel = draft._topLevel.assureItem(ref)
                    } else {
                        draft._topLevel = new ReferenceList([ref])
                    }
                    return draft
                }
            })
            setReferenceExistingOpen(false)
        },
        [readonly, standardForm, updateStandard]
    )

    const rowBg = alpha(
        theme.palette.primary.main,
        theme.palette.mode === "dark" ? 0.15 : 0.08
    )
    const rowHoverBg = alpha(
        theme.palette.primary.main,
        theme.palette.mode === "dark" ? 0.35 : 0.18
    )

    const refExistingIsEven = (nonImageComponents.length + images.length + 2) % 2 === 1
    const addImportIsEven = (nonImageComponents.length + images.length + 3) % 2 === 1

    const actionAffordances = (
        <>
            {images.map((image) => (
                <ImageHeader
                    key={image.universalKey ?? image.key}
                    ItemId={image.universalKey ?? ""}
                    onClick={() => {}}
                />
            ))}
            {!readonly && (
                <>
                    <Box
                        sx={{
                            borderRadius: "4px",
                            backgroundColor: addExpanded ? rowBg : undefined,
                            "&:hover": addExpanded ? undefined : { backgroundColor: rowHoverBg }
                        }}
                    >
                        <Box
                            onClick={() => setAddExpanded((p) => !p)}
                            role="button"
                            tabIndex={0}
                            aria-expanded={addExpanded}
                            aria-label={
                                addExpanded
                                    ? "Collapse add options"
                                    : "Expand to add component"
                            }
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault()
                                    setAddExpanded((p) => !p)
                                }
                            }}
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                padding: "0.5em 0.75em",
                                cursor: "pointer",
                                borderRadius: "4px",
                                backgroundColor: !addExpanded ? rowBg : "transparent",
                                "&:hover": { backgroundColor: rowHoverBg }
                            }}
                        >
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 0.5,
                                    width: "38px",
                                    flexShrink: 0,
                                    color: "text.secondary"
                                }}
                            >
                                <AddIcon sx={{ fontSize: "1.25rem" }} />
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="body2" noWrap>
                                    Add component
                                </Typography>
                            </Box>
                            <IconButton size="small" sx={{ padding: "0.25em" }} aria-hidden>
                                {addExpanded ? (
                                    <ExpandLessIcon fontSize="small" />
                                ) : (
                                    <ExpandMoreIcon fontSize="small" />
                                )}
                            </IconButton>
                        </Box>

                        {addExpanded && (
                            <Box
                                sx={{
                                    padding: "0 0.75em 0.75em 0.75em",
                                    paddingLeft: "calc(38px + 8px + 0.75em)",
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: 0.5
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {ADD_OPTIONS.map(({ tag, icon, label }) => (
                                    <Button
                                        key={tag}
                                        size="small"
                                        variant="contained"
                                        startIcon={icon}
                                        onClick={addAsset(tag)}
                                        sx={{ textTransform: "none" }}
                                    >
                                        {label}
                                    </Button>
                                ))}
                            </Box>
                        )}
                    </Box>
                    <Box
                        onClick={() => setReferenceExistingOpen(true)}
                        role="button"
                        tabIndex={0}
                        aria-label="Reference existing component from this asset"
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault()
                                setReferenceExistingOpen(true)
                            }
                        }}
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            padding: "0.5em 0.75em",
                            cursor: "pointer",
                            borderRadius: "4px",
                            backgroundColor: refExistingIsEven ? rowBg : "transparent",
                            "&:hover": { backgroundColor: rowHoverBg }
                        }}
                    >
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 0.5,
                                width: "38px",
                                flexShrink: 0,
                                color: "text.secondary"
                            }}
                        >
                            <LinkIcon sx={{ fontSize: "1.25rem" }} />
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" noWrap>
                                Reference existing
                            </Typography>
                        </Box>
                    </Box>
                    <Box
                        onClick={() => setImportDialogOpen(true)}
                        role="button"
                        tabIndex={0}
                        aria-label="Import component from another asset"
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault()
                                setImportDialogOpen(true)
                            }
                        }}
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            padding: "0.5em 0.75em",
                            cursor: "pointer",
                            borderRadius: "4px",
                            backgroundColor: addImportIsEven ? rowBg : "transparent",
                            "&:hover": { backgroundColor: rowHoverBg }
                        }}
                    >
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 0.5,
                                width: "38px",
                                flexShrink: 0,
                                color: "text.secondary"
                            }}
                        >
                            <ImportExportIcon sx={{ fontSize: "1.25rem" }} />
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" noWrap>
                                Import
                            </Typography>
                        </Box>
                    </Box>
                </>
            )}
            <ImportComponentDialog
                open={importDialogOpen}
                onClose={() => setImportDialogOpen(false)}
                assetId={AssetId}
                onImportSelect={handleImportSelect}
            />
            <ComponentSelectorDialog
                open={referenceExistingOpen}
                onClose={() => setReferenceExistingOpen(false)}
                onSelect={handleReferenceExistingSelect}
                isExcluded={isTopLevelExcluded}
            />
        </>
    )

    return (
        <ReferenceListEditorGeneric
            title={title}
            items={items}
            summary={summary}
            defaultExpanded={defaultExpanded}
            disabled={readonly}
            variant="table"
            onItemClick={handleItemClick}
            onItemRemove={handleItemRemove}
            actionAffordances={actionAffordances}
        />
    )
}

export default TopLevelEditor
