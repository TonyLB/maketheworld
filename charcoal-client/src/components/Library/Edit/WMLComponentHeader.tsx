import { FunctionComponent, ReactChild, useCallback } from 'react'

import HomeIcon from '@mui/icons-material/Home'
import { SxProps } from '@mui/material'

import { isNormalComponent } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import AssetDataHeader, { AssetDataHeaderRenderFunction} from './AssetDataHeader'
import { taggedMessageToString } from '@tonylb/mtw-interfaces/dist/messages'

interface WMLComponentHeaderProps {
    ItemId: string;
    onClick: () => void;
    icon?: ReactChild;
    sx?: SxProps;
    selected?: boolean;
}

export const WMLComponentHeader: FunctionComponent<WMLComponentHeaderProps> = ({ ItemId, onClick, icon, sx, selected }) => {
    const primaryBase: AssetDataHeaderRenderFunction = ({ item, inheritedItem: defaultItem }) => {
        if (isNormalComponent(item)) {
            const aggregateName = item.appearances
                .filter(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'If'))))
                .map(({ name = [] }) => name)
                .reduce((previous, name) => ([ ...previous, ...name ]), [])
            return `${taggedMessageToString(defaultItem?.appearances?.[0]?.name || [])}${taggedMessageToString(aggregateName)}` || 'Untitled'

        }
        return ''
    }
    const primary = useCallback(primaryBase, [])
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
