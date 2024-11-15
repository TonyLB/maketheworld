import React, { FunctionComponent, ReactChild, useCallback } from 'react'

import HomeIcon from '@mui/icons-material/Home'
import { SxProps } from '@mui/material'

import AssetDataHeader, { AssetDataHeaderRenderFunction} from './AssetDataHeader'
import { useLibraryAsset } from './LibraryAsset'
import { schemaOutputToString } from '@tonylb/mtw-wml/dist/schema/utils/schemaOutput/schemaOutputToString'
import MiniChip from '../../MiniChip'
import { ignoreWrapped } from '@tonylb/mtw-wml/dist/schema/utils'
import StandardRoom from '@tonylb/mtw-wml/dist/standardize/components/room'
import StandardFeature from '@tonylb/mtw-wml/dist/standardize/components/feature'
import StandardKnowledge from '@tonylb/mtw-wml/dist/standardize/components/knowledge'
import StandardMap from '@tonylb/mtw-wml/dist/standardize/components/map'
import { hasName, hasShortName } from '@tonylb/mtw-wml/dist/standardize'

interface WMLComponentHeaderProps {
    ItemId: string;
    onClick: () => void;
    icon?: ReactChild;
    sx?: SxProps;
    selected?: boolean;
}

const WMLComponentName: FunctionComponent<{ itemId: string }> = ({ itemId }) => {
    const { inheritedStandardForm, standardForm } = useLibraryAsset()
    const component = standardForm.byId[itemId]
    if (!component) {
        return <React.Fragment>Untitled</React.Fragment>
    }
    if (hasShortName(component)) {
        return <React.Fragment>
            { schemaOutputToString(ignoreWrapped(component.shortName)?.children ?? []) || 'Untitled' }
            { itemId in inheritedStandardForm.byId ? <MiniChip text="Imported" /> : null}
        </React.Fragment>
    }
    else if (hasName(component)) {  
        return <React.Fragment>
            { schemaOutputToString(ignoreWrapped(component.name)?.children ?? []) || 'Untitled' }
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
