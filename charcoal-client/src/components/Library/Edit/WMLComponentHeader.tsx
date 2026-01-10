import React, { FunctionComponent, ReactChild, useCallback } from 'react'

import HomeIcon from '@mui/icons-material/Home'
import { IconButton, SxProps } from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'

import AssetDataHeader, { AssetDataHeaderRenderFunction} from './AssetDataHeader'
import { useLibraryAsset } from './LibraryAsset'
import { schemaOutputToString } from '@tonylb/mtw-wml/ts/schema/utils/schemaOutput/schemaOutputToString'
import MiniChip from '../../MiniChip'
import { ignoreWrapped } from '@tonylb/mtw-wml/ts/schema/utils'
import { hasName, hasShortName } from '@tonylb/mtw-wml/ts/standardize'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'

interface WMLComponentHeaderProps {
    ItemId: ComponentUUID;
    onClick: () => void;
    icon?: ReactChild;
    sx?: SxProps;
    selected?: boolean;
}

const WMLComponentName: FunctionComponent<{ itemId: ComponentUUID }> = ({ itemId }) => {
    const { inheritedStandardForm, standardForm } = useLibraryAsset()
    const component = standardForm.byUniversalId[itemId]
    if (!component) {
        return <React.Fragment>Untitled</React.Fragment>
    }
    if (hasShortName(component)) {
        return <React.Fragment>
            { component.shortName?._payload?.plain.toJSON() || 'Untitled' }
            { itemId in inheritedStandardForm.byUniversalId ? <MiniChip text="Imported" /> : null}
        </React.Fragment>
    }
    else if (hasName(component)) {  
        return <React.Fragment>
            { schemaOutputToString(ignoreWrapped(component.name)?.children ?? []) || 'Untitled' }
            { itemId in inheritedStandardForm.byUniversalId ? <MiniChip text="Imported" /> : null}
        </React.Fragment>
    }
    return null
}

export const WMLComponentHeader: FunctionComponent<WMLComponentHeaderProps> = ({ ItemId, onClick, icon, sx, selected }) => {
    const { updateStandard } = useLibraryAsset()
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
        actions={
            <IconButton
                onClick={() => {
                    updateStandard({ type: 'removeComponent', componentKey: ItemId })
                }}
            >
                <DeleteIcon />
            </IconButton>
        }
    />
}

export default WMLComponentHeader
