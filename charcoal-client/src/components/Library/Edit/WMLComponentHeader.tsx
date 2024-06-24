import React, { FunctionComponent, ReactChild, useCallback } from 'react'

import HomeIcon from '@mui/icons-material/Home'
import { SxProps } from '@mui/material'

import { isNormalComponent } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import AssetDataHeader, { AssetDataHeaderRenderFunction} from './AssetDataHeader'
import { taggedMessageToString } from '@tonylb/mtw-interfaces/dist/messages'
import { useLibraryAsset } from './LibraryAsset'
import { schemaOutputToString } from '@tonylb/mtw-wml/dist/schema/utils/schemaOutput/schemaOutputToString'
import { selectName } from '@tonylb/mtw-wml/dist/normalize/selectors/name'
import { isStandardFeature, isStandardKnowledge, isStandardMap, isStandardRoom } from '@tonylb/mtw-wml/dist/standardize/baseClasses'
import MiniChip from '../../MiniChip'

interface WMLComponentHeaderProps {
    ItemId: string;
    onClick: () => void;
    icon?: ReactChild;
    sx?: SxProps;
    selected?: boolean;
}

const WMLComponentName: FunctionComponent<{ itemId: string }> = ({ itemId }) => {
    const { inheritedStandardForm, combinedStandardForm } = useLibraryAsset()
    const component = combinedStandardForm.byId[itemId]
    if (!component) {
        return <React.Fragment>Untitled</React.Fragment>
    }
    if (isStandardRoom(component)) {
        return <React.Fragment>
            { schemaOutputToString(component.shortName.children) || 'Untitled' }
            { itemId in inheritedStandardForm.byId ? <MiniChip text="Imported" /> : null}
        </React.Fragment>
    }
    if (isStandardFeature(component) || isStandardKnowledge(component) || isStandardMap(component)) {
        return <React.Fragment>
            { schemaOutputToString(component.name.children) || 'Untitled' }
            { itemId in inheritedStandardForm.byId ? <MiniChip text="Imported" /> : null}
        </React.Fragment>
    }
    return null
}

export const WMLComponentHeader: FunctionComponent<WMLComponentHeaderProps> = ({ ItemId, onClick, icon, sx, selected }) => {
    const primary = useCallback((key) => (<WMLComponentName itemId={key} />), [])

    const secondaryBase: AssetDataHeaderRenderFunction = (key) => (key)
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
