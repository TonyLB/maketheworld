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
import LandscapeIcon from "@mui/icons-material/Landscape"
import CallMadeIcon from "@mui/icons-material/CallMade"

import { useWorkbenchAsset } from "../useWorkbenchAsset"
import { useWorkbenchAssetMeta } from "../WorkbenchAssetMeta/useWorkbenchAssetMeta"
import { useDispatch } from "react-redux"
import { addOnboardingComplete } from "../../../../slices/player/index.api"
import { navigateToComponent } from "../../../../slices/UI/workbench"
import { confirmSiteDisassociateBeforeAssetMetaDisassociate } from "../consistency/confirmSiteDisassociateBeforeLocalEdit"
import { purgeComponentFromAssetFlow } from "../consistency/purgeComponentFromAssetFlow"
import { componentDisplayLabel } from "../../../../lib/componentDisplayLabel"
import { applyWorkingAssetMetaToDraft } from "../workbenchMutations"
import { ReferenceListEditorGeneric } from "./ReferenceListEditorGeneric"
import {
    isPinnedOnTopLevel,
    pinReferenceOnTopLevel,
    removeReferenceFromListById
} from "./referenceListMutations"
import { buildTopLevelDisplayItems } from "./topLevelDisplayAdapter"
import ImportComponentDialog from "../../ImportComponentDialog"
import { ComponentSelectorDialog } from "../ComponentSelector"
import ImageHeader from "../../ImageHeader"
import { ReferenceList } from "@tonylb/mtw-wml/ts/standardize/keys/referenceList"
import StandardReference from "@tonylb/mtw-wml/ts/standardize/components/reference"
import StandardCharacter from "@tonylb/mtw-wml/ts/standardize/components/character"
import StandardRoom from "@tonylb/mtw-wml/ts/standardize/components/room"
import StandardFeature from "@tonylb/mtw-wml/ts/standardize/components/feature"
import StandardKnowledge from "@tonylb/mtw-wml/ts/standardize/components/knowledge"
import StandardMap from "@tonylb/mtw-wml/ts/standardize/components/map"
import StandardImage from "@tonylb/mtw-wml/ts/standardize/components/image"
import StandardArea from "@tonylb/mtw-wml/ts/standardize/components/area"
import { StandardComponent } from "@tonylb/mtw-wml/ts/standardize/components/baseClasses"
import { enforceTypedKey } from "@tonylb/mtw-utilities/ts/types"
import { v4 as uuidv4 } from "uuid"
import { AssetUUID, ComponentUUID } from "@tonylb/mtw-base/ts/schema"
import type { SchemaImportMapping } from "@tonylb/mtw-base/ts/schema/metaData"

type AddComponentTag = "Character" | "Map" | "Room" | "Area" | "Feature" | "Knowledge" | "Image" | "Situation"

const ADD_OPTIONS: { tag: AddComponentTag; icon: React.ReactNode; label: string }[] = [
    { tag: "Character", icon: <PersonIcon sx={{ fontSize: "1rem" }} />, label: "Character" },
    { tag: "Map", icon: <MapIcon sx={{ fontSize: "1rem" }} />, label: "Map" },
    { tag: "Area", icon: <LandscapeIcon sx={{ fontSize: "1rem" }} />, label: "Area" },
    { tag: "Room", icon: <HomeIcon sx={{ fontSize: "1rem" }} />, label: "Room" },
    { tag: "Feature", icon: <FeatureIcon sx={{ fontSize: "1rem" }} />, label: "Feature" },
    { tag: "Knowledge", icon: <KnowledgeIcon sx={{ fontSize: "1rem" }} />, label: "Knowledge" },
    { tag: "Image", icon: <ImageIcon sx={{ fontSize: "1rem" }} />, label: "Image" },
    { tag: "Situation", icon: <TextSnippetIcon sx={{ fontSize: "1rem" }} />, label: "Situation" }
]

const TAG_ICONS: Record<string, React.ReactNode> = {
    Character: <PersonIcon sx={{ fontSize: "1.25rem" }} />,
    Map: <MapIcon sx={{ fontSize: "1.25rem" }} />,
    Area: <LandscapeIcon sx={{ fontSize: "1.25rem" }} />,
    Room: <HomeIcon sx={{ fontSize: "1.25rem" }} />,
    Feature: <FeatureIcon sx={{ fontSize: "1.25rem" }} />,
    Knowledge: <KnowledgeIcon sx={{ fontSize: "1.25rem" }} />,
    Image: <ImageIcon sx={{ fontSize: "1.25rem" }} />,
    Situation: <TextSnippetIcon sx={{ fontSize: "1.25rem" }} />
}

const isTopLevelAssociable = (comp: StandardComponent): boolean =>
    comp instanceof StandardRoom ||
    comp instanceof StandardArea ||
    comp instanceof StandardFeature ||
    comp instanceof StandardKnowledge ||
    comp instanceof StandardMap ||
    comp instanceof StandardCharacter ||
    comp instanceof StandardImage

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
    const {
        standardForm,
        localStandardForm,
        materializeComponentInAsset,
        readonly: assetReadonly,
        AssetId,
        inheritedStandardForm
    } = useWorkbenchAsset()
    const { working, updateAssetMeta, readonly: sessionReadonly } = useWorkbenchAssetMeta()
    const readonly = assetReadonly || sessionReadonly

    const [addExpanded, setAddExpanded] = useState(false)
    const [importDialogOpen, setImportDialogOpen] = useState(false)
    const [referenceExistingOpen, setReferenceExistingOpen] = useState(false)

    const referenceList = useMemo(
        () => working?.topLevel ?? new ReferenceList([]),
        [working?.topLevel]
    )

    const topLevelComponents = useMemo<StandardComponent[]>(() => {
        if (!working?.topLevel) return []
        return working.topLevel.payload
            .map((ref) => standardForm._lookup(ref.standardKey.toJSON()))
            .filter((c): c is StandardComponent => c !== undefined)
    }, [working?.topLevel, standardForm])

    const images = useMemo(
        () => topLevelComponents.filter((c): c is StandardImage => c instanceof StandardImage),
        [topLevelComponents]
    )

    const nonImageComponents = useMemo(
        () => topLevelComponents.filter((c) => !(c instanceof StandardImage)),
        [topLevelComponents]
    )

    const items = useMemo(() => {
        const baseItems = buildTopLevelDisplayItems({
            standardForm,
            pinnedList: referenceList
        })
        return baseItems.map((item) => {
            const comp = standardForm.byUniversalId[item.id as ComponentUUID] as StandardComponent | undefined
            const tag = comp?.tag
            const icon = tag ? TAG_ICONS[tag] : undefined
            const isImported =
                Boolean(inheritedStandardForm.byUniversalId[item.id as ComponentUUID]) || Boolean(comp?._from)
            return {
                ...item,
                showPinAction: item.rowKind === "displayOnly",
                showUnpinAction: item.rowKind === "pinned",
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

    const listSummary = useMemo(() => {
        if (!items.length) return undefined
        return items.map(({ title: t }) => t).filter(Boolean).join(", ")
    }, [items])

    const updateReferenceList = useCallback(
        (mutate: (ctx: { referenceList: ReferenceList }) => void) => {
            if (readonly || !working) {
                return
            }
            updateAssetMeta((draft) => {
                mutate({ referenceList: draft.topLevel })
            })
        },
        [readonly, working, updateAssetMeta]
    )

    const handleItemPin = useCallback(
        (id: string) => {
            if (readonly || !working) {
                return
            }
            const comp = standardForm.byUniversalId[id as ComponentUUID]
            const ref = comp?.reference ?? new StandardReference(id as ComponentUUID)
            updateAssetMeta((draft) => {
                draft.topLevel = pinReferenceOnTopLevel(draft.topLevel, ref)
            })
        },
        [readonly, working, standardForm, updateAssetMeta]
    )

    const handleItemRemove = useCallback(
        (id: string) => {
            if (readonly || !working) {
                return
            }
            if (!isPinnedOnTopLevel(working.topLevel, id)) {
                return
            }
            void (async () => {
                const proceed = await confirmSiteDisassociateBeforeAssetMetaDisassociate({
                    dispatch,
                    localStandardForm,
                    standardForm,
                    working,
                    removeId: id
                })
                if (!proceed) {
                    return
                }
                updateAssetMeta((draft) => {
                    removeReferenceFromListById(draft.topLevel, id)
                })
            })()
        },
        [readonly, working, dispatch, localStandardForm, standardForm, updateAssetMeta]
    )

    const handleItemPurge = useCallback(
        (id: string) => {
            if (readonly || !working) {
                return
            }
            void (async () => {
                const comp = standardForm.byUniversalId[id as ComponentUUID]
                const reference =
                    working.topLevel.payload.find(
                        (ref) => ref.universalKey === id || ref.key === id
                    ) ?? new StandardReference(id as ComponentUUID)
                const targetLabel = comp
                    ? componentDisplayLabel(comp, { standardForm, fallbackLabel: 'Untitled' })
                    : undefined
                await purgeComponentFromAssetFlow({
                    dispatch,
                    assetId: AssetId,
                    localStandardForm,
                    reference,
                    targetLabel,
                    previewOptions: {
                        applyLocal: (draft) => {
                            applyWorkingAssetMetaToDraft(draft, working)
                        }
                    }
                })
            })()
        },
        [readonly, working, dispatch, localStandardForm, standardForm, AssetId]
    )

    const handleItemClick = useCallback(
        (id: string) => {
            dispatch(navigateToComponent(id as ComponentUUID))
        },
        [dispatch]
    )

    const addAsset = useCallback(
        (tag: AddComponentTag) => () => {
            if (readonly || !working) {
                return
            }
            if (tag === "Room") {
                dispatch(addOnboardingComplete(["addRoom"]))
            }
            const tagUpper = tag.toUpperCase() as
                | "ROOM"
                | "AREA"
                | "FEATURE"
                | "KNOWLEDGE"
                | "CHARACTER"
                | "MAP"
                | "IMAGE"
                | "SITUATION"
            const enforceKey = enforceTypedKey(tagUpper)
            const uuid = tag === "Situation" ? `situation-${Date.now()}` : uuidv4()
            const universalKey = enforceKey(uuid) as ComponentUUID

            void (async () => {
                const ref = await materializeComponentInAsset({ universalKey })
                updateAssetMeta((draft) => {
                    draft.topLevel = draft.topLevel.assureItem(ref)
                })
            })()
            setAddExpanded(false)
        },
        [readonly, working, dispatch, materializeComponentInAsset, updateAssetMeta]
    )

    const handleImportSelect = useCallback(
        (fromAsset: AssetUUID, uuid: ComponentUUID, tag: SchemaImportMapping["type"]) => {
            if (readonly || !working) {
                return
            }
            void (async () => {
                const ref = await materializeComponentInAsset({ universalKey: uuid, fromAsset })
                updateAssetMeta((draft) => {
                    draft.topLevel = draft.topLevel.assureItem(ref)
                })
            })()
            setImportDialogOpen(false)
        },
        [readonly, working, materializeComponentInAsset, updateAssetMeta]
    )

    const isTopLevelExcluded = useCallback(
        (universalKey: ComponentUUID) => {
            if (isPinnedOnTopLevel(referenceList, universalKey)) return true
            const comp = standardForm.byUniversalId[universalKey] as StandardComponent | undefined
            if (!comp) return true
            return !isTopLevelAssociable(comp)
        },
        [referenceList, standardForm]
    )

    const handleReferenceExistingSelect = useCallback(
        (universalKey: ComponentUUID) => {
            if (readonly || !working) {
                return
            }
            const comp = standardForm.byUniversalId[universalKey] as StandardComponent | undefined
            if (!comp || !isTopLevelAssociable(comp)) {
                return
            }
            void (async () => {
                const ref = await materializeComponentInAsset({ universalKey })
                updateAssetMeta((draft) => {
                    draft.topLevel = draft.topLevel.assureItem(ref)
                })
            })()
            setReferenceExistingOpen(false)
        },
        [readonly, working, standardForm, materializeComponentInAsset, updateAssetMeta]
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

    if (!working) {
        return null
    }

    return (
        <ReferenceListEditorGeneric
            title={title}
            items={items}
            summary={listSummary}
            defaultExpanded={defaultExpanded}
            disabled={readonly}
            variant="table"
            onItemClick={handleItemClick}
            onItemPin={handleItemPin}
            onItemRemove={handleItemRemove}
            onItemPurge={handleItemPurge}
            actionAffordances={actionAffordances}
        />
    )
}

export default TopLevelEditor
