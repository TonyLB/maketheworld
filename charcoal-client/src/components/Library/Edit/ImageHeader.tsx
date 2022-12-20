import { FunctionComponent, useCallback } from 'react'

import HomeIcon from '@mui/icons-material/Home'
import { SxProps } from '@mui/material'

import AssetDataHeader, { AssetDataHeaderRenderFunction} from './AssetDataHeader'
import FileWrapper, { useFileWrapper } from '../FileInputWrapper';

interface ImageHeaderProps {
    ItemId: string;
    onClick: () => void;
    sx?: SxProps;
    selected?: boolean;
}

const ImageHeaderInterior: FunctionComponent<ImageHeaderProps> = ({ ItemId, onClick, sx, selected }) => {
    const primaryBase: AssetDataHeaderRenderFunction = ({ item }) => (item.key)
    const primary = useCallback(primaryBase, [])
    const { dragActive } = useFileWrapper()
    return <AssetDataHeader
        ItemId={ItemId}
        icon={<HomeIcon />}
        primary={primary}
        onClick={onClick}
        sx={sx}
        selected={dragActive}
    />
}

export const ImageHeader: FunctionComponent<ImageHeaderProps> = (props) => {
    return <FileWrapper>
        <ImageHeaderInterior {...props} />
    </FileWrapper>
}

export default ImageHeader
