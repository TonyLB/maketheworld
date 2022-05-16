import React, { FunctionComponent, useCallback } from 'react'

import ExitIcon from '@mui/icons-material/CallMade'

import { isNormalExit } from '../../../wml/normalize'
import AssetDataHeader, { AssetDataHeaderRenderFunction} from './AssetDataHeader'
import { noConditionContext } from './utilities'

interface RoomExitHeaderProps {
    ItemId: string;
    onClick?: () => void;
}

export const RoomExitHeader: FunctionComponent<RoomExitHeaderProps> = ({ ItemId, onClick }) => {
    const primaryBase: AssetDataHeaderRenderFunction = ({ item, defaultItem, rooms }) => {
        if (isNormalExit(item)) {
            return <React.Fragment>
                { item.name || defaultItem.name }
            </React.Fragment>
        }
        return ''
    }
    const primary = useCallback(primaryBase, [])
    const secondaryBase: AssetDataHeaderRenderFunction = ({ item }) => (item.key)
    const secondary = useCallback(secondaryBase, [])
    return <AssetDataHeader
        ItemId={ItemId}
        icon={<ExitIcon />}
        primary={primary}
        secondary={secondary}
        onClick={onClick}
    />
}

export default RoomExitHeader
