import { FunctionComponent, useCallback } from 'react'

import HomeIcon from '@mui/icons-material/Home'
import UploadIcon from '@mui/icons-material/Upload'
import { Box, SxProps } from '@mui/material'

import AssetDataHeader, { AssetDataHeaderRenderFunction} from './AssetDataHeader'
import FileWrapper, { useFileWrapper } from '../FileInputWrapper';
import { useLibraryAsset } from './LibraryAsset';
import { useDispatch } from 'react-redux';
import { setLoadedImage } from '../../../slices/personalAssets';

interface ImageHeaderProps {
    ItemId: string;
    onClick: () => void;
    sx?: SxProps;
    selected?: boolean;
}

const ImageHeaderInterior: FunctionComponent<ImageHeaderProps> = ({ ItemId, onClick, sx, selected }) => {
    const { loadedImages } = useLibraryAsset()
    const primaryBase: AssetDataHeaderRenderFunction = ({ item }) => (item.key)
    const primary = useCallback(primaryBase, [])
    const secondaryBase: AssetDataHeaderRenderFunction = ({ item }) => (loadedImages[item.key]?.type)
    const secondary = useCallback(secondaryBase, [loadedImages])
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
            icon={<UploadIcon onClick={openUpload} />}
            primary={primary}
            secondary={secondary}
            onClick={onClick}
            sx={sx}
            selected={selected}
        />
    </Box>
}

export const ImageHeader: FunctionComponent<ImageHeaderProps> = (props) => {
    const { AssetId } = useLibraryAsset()
    const dispatch = useDispatch()
    const onDrop = useCallback((file: File) => {
        console.log(`Dropping type: ${JSON.stringify(file.type)}`)
        dispatch(setLoadedImage(AssetId)({ itemId: props.ItemId, file }))
    }, [dispatch, props.ItemId])
    return <FileWrapper
        fileTypes={['image/gif', 'image/jpeg', 'image/png', 'image/bmp', 'image/tiff']}
        onFile={onDrop}
    >
        <ImageHeaderInterior {...props} />
    </FileWrapper>
}

export default ImageHeader
