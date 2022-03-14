import React, { FunctionComponent } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import {
    getCurrentWML
} from '../../../slices/personalAssets'

interface WMLEditProps {
    AssetId: string;
}

export const WMLEdit: FunctionComponent<WMLEditProps> = ({ AssetId }) => {
    const currentWML = useSelector(getCurrentWML(`ASSET#${AssetId}`))
    return <div>Test</div>
}

export default WMLEdit
