import * as React from "react"
import { FunctionComponent, useMemo } from "react"
import { useLibraryAsset } from "./LibraryAsset"
import { getRecentlyVisited } from "../../../slices/messages/selectors"
import { useSelector } from "react-redux"

type RecentlyVisitedProps = {

}

export const RecentlyVisited: FunctionComponent<RecentlyVisitedProps> = () => {
    const { standardForm } = useLibraryAsset()
    
    const recentlyVisitedTimestamp = useMemo(() => (Date.now() - 1000 * 60 * 15), [])
    const recentlyVisited = useSelector(getRecentlyVisited(recentlyVisitedTimestamp))

    return <React.Fragment>
        { recentlyVisited.map(({ fromAssetId, key, name }, index) => (<div key={`recentlyVisited-${index}`}>{ `${fromAssetId}[${key}]: ${name}` }</div>)) }
    </React.Fragment>
}