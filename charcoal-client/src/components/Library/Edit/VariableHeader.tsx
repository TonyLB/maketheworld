import { FunctionComponent, useCallback } from 'react'

import UploadIcon from '@mui/icons-material/Upload'
import { Box, IconButton, SxProps } from '@mui/material'

import AssetDataHeader, { AssetDataHeaderRenderFunction} from './AssetDataHeader'
import FileWrapper, { useFileWrapper } from '../FileInputWrapper';
import { useLibraryAsset, useLibraryImageURL } from './LibraryAsset';
import { useDispatch } from 'react-redux';
import { setLoadedImage } from '../../../slices/personalAssets';

interface VariableHeaderProps {
    ItemId: string;
    onClick: () => void;
    sx?: SxProps;
    selected?: boolean;
}

const VariableHeaderInterior: FunctionComponent<VariableHeaderProps> = ({ ItemId, onClick, sx, selected }) => {
    const primaryBase: AssetDataHeaderRenderFunction = ({ item }) => (item.key)
    const primary = useCallback(primaryBase, [])
    const { dragActive, openUpload } = useFileWrapper()

    return <Box sx={dragActive
        ? {
            borderRadius: '5px',
            borderStyle: 'dashed',
            borderWidth: '2px',
            borderColor: 'lightGrey',
        }
        : {
            padding: '2px'
        }}>
        <AssetDataHeader
            ItemId={ItemId}
            icon={
                <Box>
                </Box>
            }
            primary={primary}
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
