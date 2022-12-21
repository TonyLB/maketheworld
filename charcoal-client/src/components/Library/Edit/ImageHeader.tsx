import { FunctionComponent, useCallback, useEffect, useMemo, useState } from 'react'

import HomeIcon from '@mui/icons-material/Home'
import UploadIcon from '@mui/icons-material/Upload'
import { Box, IconButton, ListItemIcon, SxProps } from '@mui/material'

import AssetDataHeader, { AssetDataHeaderRenderFunction} from './AssetDataHeader'
import FileWrapper, { useFileWrapper } from '../FileInputWrapper';
import { useLibraryAsset, useLibraryImageURL } from './LibraryAsset';
import { useDispatch, useSelector } from 'react-redux';
import { setLoadedImage } from '../../../slices/personalAssets';
import { getConfiguration } from '../../../slices/configuration'

interface ImageHeaderProps {
    ItemId: string;
    onClick: () => void;
    sx?: SxProps;
    selected?: boolean;
}

const ImageHeaderInterior: FunctionComponent<ImageHeaderProps> = ({ ItemId, onClick, sx, selected }) => {
    const primaryBase: AssetDataHeaderRenderFunction = ({ item }) => (item.key)
    const primary = useCallback(primaryBase, [])
    const { dragActive, openUpload } = useFileWrapper()

    const fileURL = useLibraryImageURL(ItemId)

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
                    {fileURL && <img style={{ maxWidth: '3em', height: 'auto' }} src={fileURL} />}
                </Box>
            }
            primary={primary}
            onClick={onClick}
            sx={sx}
            selected={selected}
            actions={<IconButton onClick={openUpload}><UploadIcon /></IconButton>}
        />
    </Box>
}

export const ImageHeader: FunctionComponent<ImageHeaderProps> = (props) => {
    const { AssetId } = useLibraryAsset()
    const dispatch = useDispatch()
    const onDrop = useCallback((file: File) => {
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
