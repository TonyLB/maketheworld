import React, { FunctionComponent } from 'react'

import {
    useRouteMatch,
    useHistory,
    useParams
} from "react-router-dom"

import Box from '@material-ui/core/Box'
import Divider from '@material-ui/core/Divider'
import Table from '@material-ui/core/Table'
import TableBody from '@material-ui/core/TableBody'
import TableCell from '@material-ui/core/TableCell'
import TableContainer from '@material-ui/core/TableContainer'
import TableHead from '@material-ui/core/TableHead'
import TableRow from '@material-ui/core/TableRow'
import Paper from '@material-ui/core/Paper'

import useMapStyles from './useMapStyles'
import MapArea from './MapArea'
import MapLayers from './MapLayers'

type MapEditProps = {
}

export const MapEdit: FunctionComponent<MapEditProps>= ({}) => {
    const localClasses = useMapStyles()
    const { url } = useRouteMatch()
    const history = useHistory()
    const { mapId }: { mapId: string } = useParams()

    return <div className={localClasses.grid}>
        <div className={localClasses.content} >
            <MapArea />
        </div>
        <div className={localClasses.sidebar} >
            <MapLayers />
        </div>
    </div>
}

export default MapEdit
