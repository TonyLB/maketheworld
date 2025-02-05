import * as React from "react"
import { FunctionComponent, useMemo } from "react"
import List from "@mui/material/List"
import ListItem from "@mui/material/ListItem"
import ListItemText from "@mui/material/ListItemText"
import { blue } from "@mui/material/colors"

import { useLibraryAsset } from "./LibraryAsset"
import { getRecentlyVisited } from "../../../slices/messages/selectors"
import { useSelector } from "react-redux"

type RecentlyVisitedProps = {

}

export const RecentlyVisited: FunctionComponent<RecentlyVisitedProps> = () => {
    const { standardForm } = useLibraryAsset()
    
    const recentlyVisitedTimestamp = useMemo(() => (Date.now() - 1000 * 60 * 15), [])
    const recentlyVisited = useSelector(getRecentlyVisited(recentlyVisitedTimestamp))

    return <List dense>
        { recentlyVisited.map(({ name, assets }) => (assets.map((assetList) => ({ ...assetList, name })))).flat(1).map(({ fromAssetId, key, name }, index) => (
            <ListItem
                key={`recentlyVisited-${index}`}
                sx={{ borderRadius: '0.5em',
                    border: '1px solid',
                    borderColor: blue[400],
                }}
            >
                <ListItemText primary={name} secondary={`${fromAssetId.split('#').slice(-1)[0]}[${key}]`} />
            </ListItem>
        )) }
    </List>
}