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
    const { normalForm, importData, rooms } = useLibraryAsset()
    const item = useMemo(() => (normalForm[ItemId]), [normalForm, ItemId])

    return <ListItem>
        <ListItemIcon>
            <MemoryIcon />
        </ListItemIcon>
        <Box sx={{ padding: '2px', display: 'flex', width: "100%", position: "relative" }}>
            <Box sx={{ flexGrow: 1, flexShrink: 1 }}>
                <Typography>{ item?.key }</Typography>
            </Box>
            <Box sx={{ flexGrow: 3, flexShring: 3 }}>
                <JSEdit />
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
