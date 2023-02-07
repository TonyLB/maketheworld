import React, { FunctionComponent, useCallback, useEffect, useState } from 'react'

import {
    Box,
    TextField,
    IconButton
} from '@mui/material'
import ExitIcon from '@mui/icons-material/CallMade'
import DeleteIcon from '@mui/icons-material/Delete'

import { isNormalExit, NormalExit, NormalReference } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import AssetDataHeader, { AssetDataHeaderRenderFunction} from './AssetDataHeader'
import { useLibraryAsset } from './LibraryAsset'
import { useDebouncedOnChange } from '../../../hooks/useDebounce'
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
    useDebouncedOnChange({ value: name, delay: 500, onChange: onChanged })
    const onChange = useCallback((event) => {
        setName(event.target.value)
    }, [setName])
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
    const { normalForm, updateNormal } = useLibraryAsset()
    //
    // TODO: Overhaul this callback to handle conditionals better, as part of the overall conditional refactor
    //
    const saveName = useCallback((name: string) => {
        let nameSet = false
        if (ItemId in normalForm) {
            const { to, from, appearances = [] } = normalForm[ItemId] as NormalExit
            const normalizer = new Normalizer()
            normalizer._normalForm = normalForm
            appearances.forEach((appearance, index) => {
                const { contextStack } = appearance
                if (!contextStack.find(({ tag }) => (tag === 'If'))) {
                    updateNormal({
                        type: 'put',
                        item: {
                            tag: 'Exit',
                            key: ItemId,
                            to,
                            from,
                            name: nameSet ? '' : name,
                            contents: []
                        },
                        position: { ...normalizer._referenceToInsertPosition({ tag: 'Exit', key: ItemId, index }), replace: true },
                    })
                    nameSet = true
                }
            })
        }
    }, [ItemId, normalForm, updateNormal])
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
            return <RoomExitHeaderBase
                targetName={
                    toTarget
                        ? `${rooms[item.to]?.defaultName}${rooms[item.to]?.localName}`
                        : `${rooms[item.from]?.defaultName}${rooms[item.from]?.localName}`
                }
                toTarget={toTarget}
                defaultName={item?.name || taggedMessageToString(defaultItem?.Name || []) || ''}
                onChanged={saveName}
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
