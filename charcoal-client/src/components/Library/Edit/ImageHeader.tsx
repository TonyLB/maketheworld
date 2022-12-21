import { FunctionComponent, useCallback, useEffect, useMemo, useState } from 'react'

import HomeIcon from '@mui/icons-material/Home'
import UploadIcon from '@mui/icons-material/Upload'
import { Box, IconButton, ListItemIcon, SxProps } from '@mui/material'

import AssetDataHeader, { AssetDataHeaderRenderFunction} from './AssetDataHeader'
import FileWrapper, { useFileWrapper } from '../FileInputWrapper';
import { useLibraryAsset } from './LibraryAsset';
import { useDispatch, useSelector } from 'react-redux';
import { setLoadedImage } from '../../../slices/personalAssets';
import { getConfiguration } from '../../../slices/configuration'

interface ImageHeaderProps {
    ItemId: string;
    onClick: () => void;
    sx?: SxProps;
    selected?: boolean;
}

type ImageHeaderSyntheticURL = {
    loadId: string;
    fileURL: string;
}

const ImageHeaderInterior: FunctionComponent<ImageHeaderProps> = ({ ItemId, onClick, sx, selected }) => {
    const { loadedImages, properties } = useLibraryAsset()
    const { AppBaseURL = '' } = useSelector(getConfiguration)
    const [syntheticURL, setSyntheticURL] = useState<ImageHeaderSyntheticURL | undefined>()
    const primaryBase: AssetDataHeaderRenderFunction = ({ item }) => (item.key)
    const primary = useCallback(primaryBase, [])
    const { dragActive, openUpload } = useFileWrapper()

    const loadedImage = useMemo(() => (
        loadedImages[ItemId]
    ), [loadedImages, ItemId])

    useEffect(() => {
        if (loadedImage?.loadId !== syntheticURL?.loadId) {
            if (syntheticURL) {
                URL.revokeObjectURL(syntheticURL.fileURL)
            }
            setSyntheticURL({
                loadId: loadedImage.loadId,
                fileURL: URL.createObjectURL(loadedImage.file)
            })
        }
        return () => {
            if (syntheticURL) {
                URL.revokeObjectURL(syntheticURL.fileURL)
            }
        }
    }, [syntheticURL, loadedImage])

    const fileURL = useMemo(() => {
        const appBaseURL = process.env.NODE_ENV === 'development' ? `https://${AppBaseURL}` : ''
        return syntheticURL ? syntheticURL.fileURL : properties[ItemId] ? `${appBaseURL}/images/${properties[ItemId].fileName}.png` : ''
    }, [syntheticURL, properties, ItemId])
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
