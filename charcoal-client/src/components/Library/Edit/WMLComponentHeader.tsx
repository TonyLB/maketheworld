import { FunctionComponent, ReactChild, useCallback } from 'react'

import HomeIcon from '@mui/icons-material/Home'
import { SxProps } from '@mui/material'

import { isNormalComponent } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import AssetDataHeader, { AssetDataHeaderRenderFunction} from './AssetDataHeader'
import { taggedMessageToString } from '@tonylb/mtw-interfaces/dist/messages'
import { useLibraryAsset } from './LibraryAsset'
import { schemaOutputToString } from '@tonylb/mtw-wml/dist/simpleSchema/utils/schemaOutput/schemaOutputToString'
import { selectName } from '@tonylb/mtw-wml/dist/normalize/selectors/name'

interface WMLComponentHeaderProps {
    ItemId: string;
    onClick: () => void;
    icon?: ReactChild;
    sx?: SxProps;
    selected?: boolean;
}

export const WMLComponentHeader: FunctionComponent<WMLComponentHeaderProps> = ({ ItemId, onClick, icon, sx, selected }) => {
    const { select } = useLibraryAsset()
    //
    // TODO: Handle inherited names
    //
    const primaryBase: AssetDataHeaderRenderFunction = ({ item, inheritedItem: defaultItem }) => {
        if (isNormalComponent(item)) {
            return schemaOutputToString(select({ key: item.key, selector: selectName })) || 'Untitled'

        }
        return ''
    }
    const primary = useCallback(primaryBase, [select])
    //
    // TODO: Replace simple passthrough function with ExplicitEdit when it has been created
    //
    const secondaryBase: AssetDataHeaderRenderFunction = ({ item }) => (item.key)
    const secondary = useCallback(secondaryBase, [])
    return <AssetDataHeader
        ItemId={ItemId}
        icon={icon ?? <HomeIcon />}
        primary={primary}
        secondary={secondary}
        onClick={onClick}
        sx={sx}
        selected={selected}
    />
}

export default WMLComponentHeader
