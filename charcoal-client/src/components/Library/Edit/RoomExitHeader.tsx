import React, { FunctionComponent, useCallback, useEffect, useState } from 'react'

import {
    Box,
    TextField,
    IconButton
} from '@mui/material'
import ExitIcon from '@mui/icons-material/CallMade'
import DeleteIcon from '@mui/icons-material/Delete'

import { isNormalExit, NormalReference } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import AssetDataHeader, { AssetDataHeaderRenderFunction} from './AssetDataHeader'
import { useLibraryAsset } from './LibraryAsset'
import useDebounce from '../../../hooks/useDebounce'
import { noConditionContext } from './utilities'
import { taggedMessageToString } from '@tonylb/mtw-interfaces/dist/messages'
import Normalizer from '@tonylb/mtw-wml/dist/normalize'

interface RoomExitHeaderBaseProps {
    defaultName: string;
    toTarget: boolean;
    targetName: string;
    onChanged?: (value: string) => void;
    onDelete?: () => void;
}

const RoomExitHeaderBase: FunctionComponent<RoomExitHeaderBaseProps> = ({ defaultName, toTarget, targetName, onChanged=() => {}, onDelete=() => {} }) => {
    const [name, setName] = useState<string>(defaultName)
    const debouncedName = useDebounce(name, 500)
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
        <Box>
            <IconButton onClick={onDelete}>
                <DeleteIcon />
            </IconButton>
        </Box>
    </Box>

}

interface RoomExitHeaderProps {
    ItemId: string;
    RoomId: string;
    onClick?: () => void;
}

export const RoomExitHeader: FunctionComponent<RoomExitHeaderProps> = ({ ItemId, RoomId, onClick }) => {
    const { wmlQuery, updateWML, normalForm, updateNormal } = useLibraryAsset()
    const saveName = useCallback(({ location }: { location: number[] }) => (name: string) => {
        if (location.length) {
            const exitQuery = wmlQuery.search(['Asset', ...location.slice(1).map((index) => (`:nthChild(${index})`))].join(''))
            exitQuery.contents(name)
            updateWML(exitQuery.source)    
        }
    }, [ItemId, RoomId, wmlQuery, updateWML])
    const onDelete = useCallback(({ to, from }: { to: string; from: string }) => () => {
        const exitKey = `${from}#${to}`
        if(exitKey in normalForm && (normalForm[exitKey].appearances ?? []).length) {
            const deleteReferences: NormalReference[] = (normalForm[exitKey].appearances || []).map((_, index) => ({ key: exitKey, index, tag: 'Exit' as 'Exit' })).reverse()
            updateNormal({
                type: 'delete',
                references: deleteReferences
            })
        }
    }, [normalForm, updateNormal])
    const primaryBase: AssetDataHeaderRenderFunction = ({ item, defaultItem, rooms }) => {
        if (isNormalExit(item)) {
            const toTarget = Boolean(item.from === RoomId)
            const location = (item.appearances?.filter(noConditionContext)?.[0]?.location) || []
            return <RoomExitHeaderBase
                targetName={
                    toTarget
                        ? `${rooms[item.to]?.defaultName}${rooms[item.to]?.localName}`
                        : `${rooms[item.from]?.defaultName}${rooms[item.from]?.localName}`
                }
                toTarget={toTarget}
                defaultName={item?.name || taggedMessageToString(defaultItem?.Name || []) || ''}
                onChanged={saveName({ location })}
                onDelete={onDelete({ to: item.to, from: item.from })}
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
