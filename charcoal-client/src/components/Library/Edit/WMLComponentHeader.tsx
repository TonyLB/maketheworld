import { FunctionComponent, useCallback } from 'react'

import HomeIcon from '@mui/icons-material/Home'

import { isNormalComponent } from '../../../wml/normalize'
import AssetDataHeader, { AssetDataHeaderRenderFunction} from './AssetDataHeader'

interface WMLComponentHeaderProps {
    ItemId: string;
    onClick: () => void;
}

export const WMLComponentHeader: FunctionComponent<WMLComponentHeaderProps> = ({ ItemId, onClick }) => {
    const primaryBase: AssetDataHeaderRenderFunction = ({ item, defaultItem }) => {
        if (isNormalComponent(item)) {
            const aggregateName = item.appearances
                .filter(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'Condition'))))
                .map(({ name = '' }) => name)
                .join('')
            return `${defaultItem?.name || ''}${aggregateName}` || 'Untitled'

        }
        return ''
    }
    const primary = useCallback(primaryBase, [])
    const secondaryBase: AssetDataHeaderRenderFunction = ({ item }) => (item.key)
    const secondary = useCallback(secondaryBase, [])
    return <AssetDataHeader
        ItemId={ItemId}
        icon={<HomeIcon />}
        primary={primary}
        secondary={secondary}
        onClick={onClick}
    />
}

export default WMLComponentHeader
