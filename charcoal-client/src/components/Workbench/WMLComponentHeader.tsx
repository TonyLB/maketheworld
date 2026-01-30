import React, { FunctionComponent, ReactChild, useCallback, useMemo } from 'react'

import HomeIcon from '@mui/icons-material/Home'
import { IconButton, SxProps } from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import CallMadeIcon from '@mui/icons-material/CallMade'

import AssetDataHeader, { AssetDataHeaderRenderFunction} from '../Editor/AssetDataHeader'
import { useWorkbenchAsset } from './foundations/useWorkbenchAsset'
import { schemaOutputToString } from '@tonylb/mtw-wml/ts/schema/utils/schemaOutput/schemaOutputToString'
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
    const { standardForm } = useWorkbenchAsset()
    const component = standardForm.byUniversalId[itemId]
    if (!component) {
        return <React.Fragment>Untitled</React.Fragment>
    }
    if (hasShortName(component)) {
        return <React.Fragment>
            { component.shortName?._payload?.plain?.toJSON() ?? 'Untitled' }
        </React.Fragment>
    }
    else if (hasName(component)) {  
        return <React.Fragment>
            { component.name ? schemaOutputToString(component.name.children as any) : 'Untitled' }
        </React.Fragment>
    }
    return null
}

export const WorkbenchWMLComponentHeader: FunctionComponent<WMLComponentHeaderProps> = ({ ItemId, onClick, icon, sx, selected }) => {
    const { updateStandard, inheritedStandardForm, standardForm } = useWorkbenchAsset()
    const primary = useCallback((key: string) => (<WMLComponentName itemId={key as ComponentUUID} />), [])

    const secondaryBase: AssetDataHeaderRenderFunction = (key) => (key)
    const secondary = useCallback(secondaryBase, [])
    
    // Check if component is imported (either in inheritedStandardForm or has _from property)
    const isImported = useMemo(() => {
        const component = standardForm.byUniversalId[ItemId]
        return Boolean(inheritedStandardForm.byUniversalId[ItemId]) || Boolean(component?._from)
    }, [ItemId, inheritedStandardForm, standardForm])
    
    const iconIndicator = isImported ? (
        <CallMadeIcon sx={{ fontSize: '0.875rem', opacity: 0.7 }} />
    ) : undefined
    
    return <AssetDataHeader
        ItemId={ItemId}
        icon={icon ?? <HomeIcon />}
        iconIndicator={iconIndicator}
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

export default WorkbenchWMLComponentHeader
