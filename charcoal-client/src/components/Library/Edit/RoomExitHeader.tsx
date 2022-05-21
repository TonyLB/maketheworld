import React, { FunctionComponent, useCallback, useState } from 'react'

import {
    Box,
    TextField
} from '@mui/material'
import ExitIcon from '@mui/icons-material/CallMade'

import { isNormalExit } from '../../../wml/normalize'
import AssetDataHeader, { AssetDataHeaderRenderFunction} from './AssetDataHeader'
import { noConditionContext } from './utilities'

interface RoomExitHeaderBaseProps {
    defaultName: string;
    toTarget: boolean;
    targetName: string;
}

const RoomExitHeaderBase: FunctionComponent<RoomExitHeaderBaseProps> = ({ defaultName, toTarget, targetName }) => {
    const [name, setName] = useState<string>(defaultName)
    const onChange = useCallback((event) => {
        setName(event.target.value)
    }, [setName])
    return <Box sx={{ width: "100%", display: "flex", flexDirection: "row" }}>
        <Box sx={{ maxWidth: "20em", flexGrow: 1, display: "flex", marginRight: "1em" }}>
            <TextField
                size="small"
                sx={{ width: "100%" }}
                value={ name }
                onChange={onChange}
            />
        </Box>
        <Box sx={{ flexGrow: 1, display: "flex", alignItems: "center" }}>
            { (toTarget) ? 'TO' : 'FROM' }&nbsp;
            {targetName}
        </Box>
    </Box>

}

interface RoomExitHeaderProps {
    ItemId: string;
    RoomId: string;
    onClick?: () => void;
}

export const RoomExitHeader: FunctionComponent<RoomExitHeaderProps> = ({ ItemId, RoomId, onClick }) => {
    const primaryBase: AssetDataHeaderRenderFunction = ({ item, defaultItem, rooms }) => {
        if (isNormalExit(item)) {
            const toTarget = Boolean(item.to === RoomId)
            return <RoomExitHeaderBase
                targetName={
                    toTarget
                        ? `${rooms[item.from]?.defaultName}${rooms[item.from]?.localName}`
                        : `${rooms[item.to]?.defaultName}${rooms[item.to]?.localName}`
                }
                toTarget={toTarget}
                defaultName={item.name || defaultItem.name || ''}
            />
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
