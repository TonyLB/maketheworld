import * as React from "react"
import { FunctionComponent, useMemo } from "react"
import List from "@mui/material/List"
import ListItem from "@mui/material/ListItem"
import ListItemText from "@mui/material/ListItemText"
import ListItemButton from "@mui/material/ListItemButton"
import ListSubheader from "@mui/material/ListSubheader"
import ExpandLess from '@mui/icons-material/ExpandLess'
import ExpandMore from '@mui/icons-material/ExpandMore'
import { blue } from "@mui/material/colors"

import { useLibraryAsset } from "./LibraryAsset"
import { getRecentlyVisited } from "../../../slices/messages/selectors"
import { useSelector } from "react-redux"
import { Collapse } from "@mui/material"

type RecentlyVisitedProps = {

}

export const RecentlyVisited: FunctionComponent<RecentlyVisitedProps> = () => {
    const { standardForm } = useLibraryAsset()
    
    const recentlyVisitedTimestamp = useMemo(() => (Date.now() - 1000 * 60 * 15), [])
    const recentlyVisited = useSelector(getRecentlyVisited(recentlyVisitedTimestamp))

    const recentlyVisitedByAsset = useMemo(() => {
        return recentlyVisited.reduce<Record<string, { key: string, name: string }[]>>((previous, { ephemeraId, name, assets }) => {
            return assets.reduce<Record<string, { key: string, name: string }[]>>((accumulator, { fromAssetId, key }) => ({
                ...accumulator,
                [fromAssetId]: [
                    ...accumulator[fromAssetId] ?? [],
                    { key, name }
                ]
            }), previous)
        }, {})
    }, [recentlyVisited])

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
                            </ListItem>
                        )) }
                    </List>
                </Collapse>
            </React.Fragment>
        )) }
    </List>
}