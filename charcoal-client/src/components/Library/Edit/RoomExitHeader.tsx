import React, { FunctionComponent, useCallback, useEffect, useState } from 'react'

import {
    Box,
    TextField
} from '@mui/material'
import ExitIcon from '@mui/icons-material/CallMade'

import { isNormalExit } from '../../../wml/normalize'
import AssetDataHeader, { AssetDataHeaderRenderFunction} from './AssetDataHeader'
import { useLibraryAsset } from './LibraryAsset'
import useDebounce from '../../../hooks/useDebounce'
import { noConditionContext } from './utilities'

interface RoomExitHeaderBaseProps {
    defaultName: string;
    toTarget: boolean;
    targetName: string;
    onChanged?: (value: string) => void;
}

const RoomExitHeaderBase: FunctionComponent<RoomExitHeaderBaseProps> = ({ defaultName, toTarget, targetName, onChanged=() => {} }) => {
    const [name, setName] = useState<string>(defaultName)
    const debouncedName = useDebounce(name, 1000)
    useEffect(() => {
        if (debouncedName !== defaultName) {
            onChanged(debouncedName)
        }
    }, [debouncedName, defaultName])
    const onChange = useCallback((event) => {
        setName(event.target.value)
    }, [setName, onChanged])
    return <Box sx={{ width: "100%", display: "flex", flexDirection: "row" }}>
        <Box sx={{ maxWidth: "12em", flexGrow: 1, display: "flex", marginRight: "1em" }}>
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
    const { wmlQuery, updateWML } = useLibraryAsset()
    const saveName = useCallback(({ location }: { location: number[] }) => (name: string) => {
        if (location.length) {
            const exitQuery = wmlQuery.search(['Asset', ...location.slice(1).map((index) => (`:nthChild(${index})`))].join(''))
            exitQuery.contents(name)
            updateWML(exitQuery.source)    
        }
    }, [ItemId, RoomId, wmlQuery, updateWML])
    const primaryBase: AssetDataHeaderRenderFunction = ({ item, defaultItem, rooms }) => {
        if (isNormalExit(item)) {
            const toTarget = Boolean(item.to === RoomId)
            const location = (item.appearances?.filter(noConditionContext)?.[0]?.location) || []
            return <RoomExitHeaderBase
                targetName={
                    toTarget
                        ? `${rooms[item.from]?.defaultName}${rooms[item.from]?.localName}`
                        : `${rooms[item.to]?.defaultName}${rooms[item.to]?.localName}`
                }
                toTarget={toTarget}
                defaultName={item.name || defaultItem.name || ''}
                onChanged={saveName({ location })}
            />
        }
        return ''
    }
    const primary = useCallback(primaryBase, [])
    return <AssetDataHeader
        ItemId={ItemId}
        icon={<ExitIcon />}
        primary={primary}
        onClick={onClick}
    />
}

export default RoomExitHeader
