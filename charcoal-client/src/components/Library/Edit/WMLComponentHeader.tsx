import { FunctionComponent, ReactChild, useCallback } from 'react'

import HomeIcon from '@mui/icons-material/Home'
import { SxProps } from '@mui/material'

import { isNormalComponent } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import AssetDataHeader, { AssetDataHeaderRenderFunction} from './AssetDataHeader'
import { taggedMessageToString } from '@tonylb/mtw-interfaces/dist/messages'
import { useLibraryAsset } from './LibraryAsset'
import { schemaOutputToString } from '@tonylb/mtw-wml/dist/schema/utils/schemaOutput/schemaOutputToString'
import { selectName } from '@tonylb/mtw-wml/dist/normalize/selectors/name'
import { isStandardFeature, isStandardKnowledge, isStandardMap, isStandardRoom } from '@tonylb/mtw-wml/dist/standardize/baseClasses'

interface WMLComponentHeaderProps {
    ItemId: string;
    onClick: () => void;
    icon?: ReactChild;
    sx?: SxProps;
    selected?: boolean;
}

export const WMLComponentHeader: FunctionComponent<WMLComponentHeaderProps> = ({ ItemId, onClick, icon, sx, selected }) => {
    const { combinedStandardForm: standardForm } = useLibraryAsset()
    const primary = useCallback(({ item }) => {
        if (isNormalComponent(item)) {
            const component = standardForm.byId[item.key]
            if (!component) {
                return 'Untitled'
            }
            if (isStandardRoom(component)) {
                return schemaOutputToString(component.shortName.children) || 'Untitled'
            }
            if (isStandardFeature(component) || isStandardKnowledge(component) || isStandardMap(component)) {
                return schemaOutputToString(component.name.children) || 'Untitled'
            }
        }
        return ''
    }, [standardForm])

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
