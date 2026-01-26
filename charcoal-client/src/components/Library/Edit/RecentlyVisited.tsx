import * as React from "react"
import { FunctionComponent, useMemo } from "react"
import List from "@mui/material/List"
import ListItem from "@mui/material/ListItem"
import ListItemText from "@mui/material/ListItemText"
import ListItemButton from "@mui/material/ListItemButton"
import ListSubheader from "@mui/material/ListSubheader"
import IconButton from "@mui/material/IconButton"
import ExpandLess from '@mui/icons-material/ExpandLess'
import ExpandMore from '@mui/icons-material/ExpandMore'
import DownloadIcon from '@mui/icons-material/Download'
import { blue } from "@mui/material/colors"

import { useLibraryAsset } from "./LibraryAsset"
import { getRecentlyVisited } from "../../../slices/messages/selectors"
import { useDispatch, useSelector } from "react-redux"
import { Collapse } from "@mui/material"
import { SchemaImportMapping } from "@tonylb/mtw-base/ts/schema/metaData"
import { addImport } from "../../../slices/personalAssets"
import { AssetUUID, ComponentUUID } from "@tonylb/mtw-base/ts/schema"

type RecentlyVisitedProps = {

}

export const RecentlyVisited: FunctionComponent<RecentlyVisitedProps> = () => {
    const dispatch = useDispatch()
    const { standardForm, AssetId } = useLibraryAsset()
    
    const recentlyVisitedTimestamp = useMemo(() => (Date.now() - 1000 * 60 * 15), [])
    const recentlyVisited = useSelector(getRecentlyVisited(recentlyVisitedTimestamp))

    const importsFromStandard = useMemo<{ fromAssetId: AssetUUID; universalKey: ComponentUUID; }[]>(() => {
        return standardForm._components.map((component) => {
            const importItem = component._from
            if (importItem && component.universalKey) {
                return [{ fromAssetId: importItem, universalKey: component.universalKey }]
            }
            return []
        }).flat(1)
    }, [standardForm.byId])

    const recentlyVisitedByAsset = useMemo(() => {
        return recentlyVisited.reduce<Record<AssetUUID, { universalKey: ComponentUUID, name: string, tag: SchemaImportMapping["type"] }[]>>((previous, { name, assets, tag }) => {
            if (assets.some(({ fromAssetId, universalKey }) => importsFromStandard.some((importItem) => importItem.fromAssetId === fromAssetId && importItem.universalKey === universalKey))) {
                return previous
            }
            return assets
                .reduce<Record<string, { universalKey: ComponentUUID, name: string, tag: SchemaImportMapping["type"] }[]>>((accumulator, { fromAssetId, universalKey }) => ({
                    ...accumulator,
                    [fromAssetId]: [
                        ...accumulator[fromAssetId] ?? [],
                        { universalKey, name, tag }
                    ]
                }), previous)
        }, {})
    }, [recentlyVisited, importsFromStandard])

    const [collapseStates, setCollapseStates] = React.useState<Record<string, boolean>>({})

    const hasItemsToShow = Object.keys(recentlyVisitedByAsset).length > 0
    if (!hasItemsToShow) return null

    return <List dense>
        <ListSubheader>Recently Visited</ListSubheader>
        { Object.entries(recentlyVisitedByAsset).map(([fromAssetId, visitList]) => (
            <React.Fragment key={fromAssetId}>
                <ListItemButton
                    sx={{
                        bgcolor: blue[100],
                        ml: '2em',
                        mr: '2em',
                        width: 'calc(100% - 4em)',
                        mb: '0.25em',
                        mt: '0.25em'
                    }}
                    onClick={() => {
                        setCollapseStates({
                            ...collapseStates,
                            [fromAssetId]: !collapseStates[fromAssetId]
                        })
                    }}
                >
                    <ListItemText primary={ `From: ${fromAssetId.split('#').slice(-1)[0] }` } />
                    { collapseStates[fromAssetId] ? <ExpandLess /> : <ExpandMore />}
                </ListItemButton>
                <Collapse in={collapseStates[fromAssetId] ?? false}>
                    <List disablePadding>
                        { visitList.map(({ name, universalKey, tag }, index) => (
                            <ListItem
                                key={`recentlyVisited-${fromAssetId}-${index}`}
                                sx={{
                                    ml: '4em',
                                    mr: '4em',
                                    width: 'calc(100% - 8em);',
                                    borderRadius: '0.5em',
                                    border: '1px solid',
                                    borderColor: blue[400],
                                }}
                            >
                                <ListItemText primary={name} secondary={universalKey} />
                                <IconButton
                                    onClick={() => {
                                        dispatch(addImport({ assetId: AssetId, fromAsset: fromAssetId as AssetUUID, uuid: universalKey, tag }))
                                    }}
                                >
                                    <DownloadIcon />
                                </IconButton>
                            </ListItem>
                        )) }
                    </List>
                </Collapse>
            </React.Fragment>
        )) }
    </List>
}