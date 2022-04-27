import { FunctionComponent } from 'react'
import { useSelector } from 'react-redux'

import {
    ListItemButton,
    ListItemText,
    ListItemIcon
} from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'

import { NormalFeature } from '../../../wml/normalize'
import { getDefaultAppearances } from '../../../slices/personalAssets'

interface FeatureHeaderProps {
    feature: NormalFeature;
    AssetId: string;
    onClick: () => void;
}

export const FeatureHeader: FunctionComponent<FeatureHeaderProps> = ({ feature, AssetId, onClick }) => {
    const defaultAppearances = useSelector(getDefaultAppearances(`ASSET#${AssetId}`))
    const aggregateName = feature.appearances
        .filter(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'Condition'))))
        .map(({ name = '' }) => name)
        .join('')
    return <ListItemButton onClick={onClick}>
        <ListItemIcon>
            <HomeIcon />
        </ListItemIcon>
        <ListItemText primary={`${defaultAppearances[feature.key]?.name || ''}${aggregateName}` || 'Untitled'} secondary={feature.key} />
    </ListItemButton>
}

export default FeatureHeader
