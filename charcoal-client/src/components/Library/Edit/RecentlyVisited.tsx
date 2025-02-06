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
import { useSelector } from "react-redux"
import { Collapse } from "@mui/material"
import { ImportItemContent, ImportItemReplace } from "@tonylb/mtw-wml/ts/standardize/components/metaData"

type RecentlyVisitedProps = {

}

export const RecentlyVisited: FunctionComponent<RecentlyVisitedProps> = () => {
    const { standardForm } = useLibraryAsset()
    
    const recentlyVisitedTimestamp = useMemo(() => (Date.now() - 1000 * 60 * 15), [])
    const recentlyVisited = useSelector(getRecentlyVisited(recentlyVisitedTimestamp))

    const importsFromStandard = useMemo<{ fromAssetId: string; key: string; }[]>(() => {
        return Object.values(standardForm.byId).map((component) => {
            const importItem = component.import
            if (importItem) {
                if (importItem instanceof ImportItemContent) {
                    return [{ fromAssetId: importItem.assetId, key: importItem.fromKey }]
                }
                if (importItem instanceof ImportItemReplace) {
                    return [{ fromAssetId: importItem._payload.assetId, key: importItem._payload.fromKey }]
                }
            }
            return []
        }).flat(1)
    }, [standardForm.byId])

    const recentlyVisitedByAsset = useMemo(() => {
        return recentlyVisited.reduce<Record<string, { key: string, name: string }[]>>((previous, { name, assets }) => {
            if (assets.some(({ fromAssetId, key }) => importsFromStandard.some((importItem) => `ASSET#${importItem.fromAssetId}` === fromAssetId && importItem.key === key))) {
                return previous
            }
            return assets
                .reduce<Record<string, { key: string, name: string }[]>>((accumulator, { fromAssetId, key }) => ({
                    ...accumulator,
                    [fromAssetId]: [
                        ...accumulator[fromAssetId] ?? [],
                        { key, name }
                    ]
                }), previous)
        }, {})
    }, [recentlyVisited, importsFromStandard])

    const [collapseStates, setCollapseStates] = React.useState<Record<string, boolean>>({})

    return <List dense>
        { Boolean(recentlyVisited.length) && <ListSubheader>Recently Visited</ListSubheader> }
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
                        { visitList.map(({ name, key }, index) => (
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
                                <ListItemText primary={name} secondary={key} />
                                <IconButton
                                    onClick={() => {}}
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