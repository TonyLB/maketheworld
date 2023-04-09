import { FunctionComponent, useCallback, useMemo } from 'react'

import MemoryIcon from '@mui/icons-material/Memory'
import { Box, IconButton, ListItem, ListItemIcon, SxProps, Typography } from '@mui/material'

import AssetDataHeader, { AssetDataHeaderRenderFunction} from './AssetDataHeader'
import { useLibraryAsset } from './LibraryAsset';
import { useDispatch } from 'react-redux';
import { isNormalVariable } from '@tonylb/mtw-wml/dist/normalize/baseClasses';
import { JSEdit } from './JSEdit';

interface VariableHeaderProps {
    ItemId: string;
    onClick: () => void;
    sx?: SxProps;
    selected?: boolean;
}

const VariableHeaderInterior: FunctionComponent<VariableHeaderProps> = ({ ItemId, onClick, sx, selected }) => {
    const { normalForm, updateNormal, importData, rooms } = useLibraryAsset()
    const item = useMemo(() => (normalForm[ItemId]), [normalForm, ItemId])
    const definingAppearance = useMemo<number>(() => ((item.appearances || []).findIndex(({ contextStack }) => (contextStack.every(({ tag }) => (['Asset', 'Character'].includes(tag)))))), [item])
    const src = isNormalVariable(item)
        ? item.default
        : ''

    return <ListItem>
        <ListItemIcon>
            <MemoryIcon />
        </ListItemIcon>
        <Box sx={{ padding: '2px', display: 'flex', width: "100%", position: "relative" }}>
            <Box sx={{ flexGrow: 2, flexShrink: 2, width: "0px" }}>
                <Typography>{ item?.key }</Typography>
            </Box>
            <Box sx={{ flexGrow: 3, flexShrink: 3, width: "0px" }}>
                <JSEdit
                    src={src}
                    onChange={(value) => {
                        if (definingAppearance >= -1) {
                            updateNormal({
                                type: 'put',
                                item: {
                                    key: ItemId,
                                    tag: 'Variable',
                                    default: value
                                },
                                reference: {
                                    key: ItemId,
                                    tag: 'Variable',
                                    index: definingAppearance
                                },
                                replace: true
                            })    
                        }
                    }}
                />
            </Box>
        </Box>

    </ListItem>
}

export const VariableHeader: FunctionComponent<VariableHeaderProps> = (props) => {
    const { AssetId } = useLibraryAsset()
    const dispatch = useDispatch()
    return <VariableHeaderInterior {...props} />
}

export default VariableHeader
