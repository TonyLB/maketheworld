import React, { FunctionComponent, useCallback } from 'react'

import {
    Box,
    TextField
} from '@mui/material'
import ExitIcon from '@mui/icons-material/CallMade'

import { isNormalExit } from '../../../wml/normalize'
import AssetDataHeader, { AssetDataHeaderRenderFunction} from './AssetDataHeader'
import { noConditionContext } from './utilities'

interface RoomExitHeaderProps {
    ItemId: string;
    RoomId: string;
    onClick?: () => void;
}

export const RoomExitHeader: FunctionComponent<RoomExitHeaderProps> = ({ ItemId, RoomId, onClick }) => {
    const primaryBase: AssetDataHeaderRenderFunction = ({ item, defaultItem, rooms }) => {
        if (isNormalExit(item)) {
            return <Box sx={{ width: "100%", display: "flex", flexDirection: "row" }}>
                <Box sx={{ maxWidth: "20em", flexGrow: 1, display: "flex", marginRight: "1em" }}>
                    <TextField size="small" sx={{ width: "100%" }} value={ item.name || defaultItem.name } />
                </Box>
                <Box sx={{ flexGrow: 1, display: "flex", alignItems: "center" }}>
                    { (item.from === RoomId) && <React.Fragment>TO { rooms[item.to]?.defaultName }{ rooms[item.to]?.localName }</React.Fragment> }
                    { (item.to === RoomId) && <React.Fragment>FROM { rooms[item.from]?.defaultName }{ rooms[item.from]?.localName }</React.Fragment> }
                </Box>
            </Box>
        }
        return ''
    }
    const primary = useCallback(primaryBase, [])
    const secondaryBase: AssetDataHeaderRenderFunction = ({ item }) => (item.key)
    const secondary = useCallback(secondaryBase, [])
    return <AssetDataHeader
        ItemId={ItemId}
        icon={<ExitIcon />}
        primary={primary}
        onClick={onClick}
    />
}

export default RoomExitHeader
