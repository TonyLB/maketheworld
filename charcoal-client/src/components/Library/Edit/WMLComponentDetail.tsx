import { FunctionComponent, useCallback, useMemo } from 'react'
import {
    useLocation,
    useNavigate,
    useParams
} from "react-router-dom"

import Box from '@mui/material/Box'
import HomeIcon from '@mui/icons-material/Home'
import { blue } from '@mui/material/colors'

import LibraryBanner from './LibraryBanner'
import DescriptionEditor from './DescriptionEditor'
import { useLibraryAsset } from './LibraryAsset'
import { isSchemaOutputTag, SchemaTag } from '@tonylb/mtw-wml/dist/schema/baseClasses'
import DraftLockout from './DraftLockout'
import RoomExitEditor from './RoomExitEditor'
import useAutoPin from '../../../slices/UI/navigationTabs/useAutoPin'
import { useOnboardingCheckpoint } from '../../Onboarding/useOnboarding'
import { addOnboardingComplete } from '../../../slices/player/index.api'
import { useDispatch } from 'react-redux'
import { rename as renameNavigationTab } from '../../../slices/UI/navigationTabs'
import { GenericTreeNode, TreeId } from '@tonylb/mtw-wml/dist/tree/baseClasses'
import { explicitSpaces } from '@tonylb/mtw-wml/dist/schema/utils/schemaOutput/explicitSpaces'
import { treeTypeGuard } from '@tonylb/mtw-wml/dist/tree/filter'
import { selectNameAsString } from '@tonylb/mtw-wml/dist/normalize/selectors/name'
import { EditSchema } from './EditContext'
import { UpdateSchemaPayload } from '../../../slices/personalAssets/reducers'
import { isStandardFeature, isStandardKnowledge, isStandardRoom, StandardFeature, StandardKnowledge, StandardRoom } from '@tonylb/mtw-wml/dist/standardize/baseClasses'
import TitledBox from '../../TitledBox'

//
// TODO: Create a selector that can extract the top-level appearance for a given Component (assuming Standardized
// format on the passed schema)
//

const WMLComponentAppearance: FunctionComponent<{ ComponentId: string }> = ({ ComponentId }) => {
    const { standardForm } = useLibraryAsset()
    const component: StandardFeature | StandardKnowledge | StandardRoom = useMemo(() => {
        if (ComponentId) {
            const component = standardForm[ComponentId]
            if (component && (isStandardFeature(component) || isStandardKnowledge(component) || isStandardRoom(component))) {
                return component
            }
        }
        return {
            key: ComponentId,
            id: '',
            tag: 'Room',
            shortName: { data: { tag: 'ShortName' }, id: '', children: [] },
            name: { data: { tag: 'Name' }, id: '', children: [] },
            summary: { data: { tag: 'Summary' }, id: '', children: [] },
            description: { data: { tag: 'Description' }, id: '', children: [] },
            exits: []
        }
    }, [ComponentId, standardForm])
    const { tag } = component
    useOnboardingCheckpoint('navigateRoom', { requireSequence: true, condition: tag === 'Room' })
    useOnboardingCheckpoint('navigateAssetWithImport', { requireSequence: true })

    if (!component.id) {
        return <Box />
    }
    return <Box sx={{
        marginLeft: '0.5em',
        marginTop: '0.5em',
        display: 'flex',
        flexDirection: 'column',
        rowGap: '0.25em',
        width: "calc(100% - 0.5em)",
        position: 'relative'
    }}>
        <EditSchema tag="Name" field={component ? component.name : { data: { tag: 'Name' }, children: [], id: '' }} parentId={component?.id ?? ''}>
            <TitledBox title={tag === 'Room' ? "Full Name" : "Name" }>
                <DescriptionEditor
                    validLinkTags={[]}
                    placeholder="Enter a name"
                />
            </TitledBox>
        </EditSchema>
        <EditSchema tag="Description" field={component ? component.description : { data: { tag: 'Description' }, children: [], id: '' } } parentId={component?.id ?? ''}>
            <TitledBox>
                <DescriptionEditor
                    validLinkTags={tag === 'Knowledge' ? ['Knowledge'] : ['Action', 'Feature', 'Knowledge']}
                    placeholder="Enter a description"
                />
            </TitledBox>
        </EditSchema>
        {
            (tag === 'Room') && <RoomExitEditor RoomId={ComponentId || ''} onChange={() => {}} />
        }
    </Box>
}

interface WMLComponentDetailProps {
}

export const WMLComponentDetail: FunctionComponent<WMLComponentDetailProps> = () => {
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const { assetKey, normalForm, updateSchema, select } = useLibraryAsset()
    const { ComponentId } = useParams<{ ComponentId: string }>()
    const location = useLocation()
    const tag = location.pathname.split('/').slice(-2)[0]
    const componentName = useMemo(() => (select({ key: ComponentId, selector: selectNameAsString })), [select, ComponentId])
    useAutoPin({
        href: `/Library/Edit/Asset/${assetKey}/${tag}/${ComponentId}`,
        label: componentName || 'Untitled',
        type: 'ComponentEdit',
        iconName: 'Room',
        assetId: `ASSET#${assetKey}`,
        componentId: ComponentId || ''
    })
    const onKeyChange = useCallback((toKey: string) => {
        updateSchema({
            type: 'rename',
            fromKey: ComponentId,
            toKey
        })
        dispatch(renameNavigationTab({
            fromHRef: `/Library/Edit/Asset/${assetKey}/${tag}/${ComponentId}`,
            toHRef: `/Library/Edit/Asset/${assetKey}/${tag}/${toKey}`,
            componentId: toKey
        }))
        navigate(`/Library/Edit/Asset/${assetKey}/${tag}/${toKey}`)
    }, [updateSchema, ComponentId, navigate, assetKey, dispatch, tag])
    const allExportKeys = Object.values(normalForm).map(({ key, exportAs }) => (exportAs ?? key))
    const nameValidate = useCallback((toKey: string) => (!(toKey !== ComponentId && (allExportKeys.includes(toKey)))), [ComponentId, allExportKeys])
    if (!(ComponentId && ComponentId in normalForm)) {
        return <Box />
    }
    return <Box sx={{ width: "100%", display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
        <LibraryBanner
            primary={componentName}
            secondary={ComponentId}
            onChangeSecondary={onKeyChange}
            validateSecondary={nameValidate}
            icon={<HomeIcon />}
            breadCrumbProps={[{
                href: '/Library',
                label: 'Library'
            },
            {
                href: `/Library/Edit/Asset/${assetKey}`,
                label: assetKey || ''
            },
            {
                label: componentName
            }]}
        />
        <Box sx={{ flexGrow: 1, position: "relative", width: "100%" }}>
            <Box sx={{ overflowY: 'auto' }}>
                <WMLComponentAppearance ComponentId={ComponentId} />
            </Box>
            <DraftLockout />
        </Box>
    </Box>
}

export default WMLComponentDetail
