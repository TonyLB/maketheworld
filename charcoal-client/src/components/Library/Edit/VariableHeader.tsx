import { FunctionComponent, useCallback } from 'react'

import MemoryIcon from '@mui/icons-material/Memory'
import { Box, IconButton, SxProps } from '@mui/material'

import AssetDataHeader, { AssetDataHeaderRenderFunction} from './AssetDataHeader'
import { useLibraryAsset } from './LibraryAsset';
import { useDispatch } from 'react-redux';
import { isNormalVariable } from '@tonylb/mtw-wml/dist/normalize/baseClasses';

interface VariableHeaderProps {
    ItemId: string;
    onClick: () => void;
    sx?: SxProps;
    selected?: boolean;
}

const VariableHeaderInterior: FunctionComponent<VariableHeaderProps> = ({ ItemId, onClick, sx, selected }) => {
    const primaryBase: AssetDataHeaderRenderFunction = ({ item }) => (item.key)
    const primary = useCallback(primaryBase, [])

    return <Box sx={{ padding: '2px' }}>
        <AssetDataHeader
            ItemId={ItemId}
            icon={<MemoryIcon />}
            primary={primary}
            secondary={({ item }) => (isNormalVariable(item) && `Default: ${item.default}`)}
            onClick={onClick}
            sx={sx}
            selected={selected}
        />
    </Box>
}

export const VariableHeader: FunctionComponent<VariableHeaderProps> = (props) => {
    const { AssetId } = useLibraryAsset()
    const dispatch = useDispatch()
    return <VariableHeaderInterior {...props} />
}

export default VariableHeader
