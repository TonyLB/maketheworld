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
import { makeStyles } from "@material-ui/core/styles"

import useMapStyles from './useMapStyles'

type MapAreaProps = {
}

export const MapArea: FunctionComponent<MapAreaProps>= ({}) => {
    const localClasses = useMapStyles()

    return <svg width="100%" height="100%" viewBox="0 0 600 400" preserveAspectRatio="xMidYMid meet">
        <circle
            cx={275}
            cy={200}
            r={30}
            className={localClasses.green}
        />
        <circle
            cx={300}
            cy={225}
            r={30}
            className={localClasses.blue}
        />
        <circle
            cx={300}
            cy={175}
            r={30}
            className={localClasses.red}
        />
    </svg>
}

export default MapArea
