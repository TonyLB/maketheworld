import { FunctionComponent } from 'react'
import { useSelector } from 'react-redux'

import {
    ListItemButton,
    ListItemText,
    ListItemIcon
} from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'

import { NormalComponent } from '../../../wml/normalize'
import { getDefaultAppearances } from '../../../slices/personalAssets'

interface WMLComponentHeaderProps {
    component: NormalComponent;
    AssetId: string;
    onClick: () => void;
}

export const WMLComponentHeader: FunctionComponent<WMLComponentHeaderProps> = ({ component, AssetId, onClick }) => {
    const defaultAppearances = useSelector(getDefaultAppearances(`ASSET#${AssetId}`))
    const aggregateName = component.appearances
        .filter(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'Condition'))))
        .map(({ name = '' }) => name)
        .join('')
    return <ListItemButton onClick={onClick}>
        <ListItemIcon>
            <HomeIcon />
        </ListItemIcon>
        <ListItemText primary={`${defaultAppearances[component.key]?.name || ''}${aggregateName}` || 'Untitled'} secondary={component.key} />
    </ListItemButton>
}

export default WMLComponentHeader
