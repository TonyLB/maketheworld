import { FunctionComponent, useCallback, useMemo } from 'react'
import {
    useLocation,
    useNavigate,
    useParams
} from "react-router-dom"

import Box from '@mui/material/Box'
import HomeIcon from '@mui/icons-material/Home'

import LibraryBanner from './LibraryBanner'
import DescriptionEditor from './DescriptionEditor'
import { useLibraryAsset } from './LibraryAsset'
import DraftLockout from './DraftLockout'
import RoomExitEditor from './RoomExitEditor'
import useAutoPin from '../../../slices/UI/navigationTabs/useAutoPin'
import { useOnboardingCheckpoint } from '../../Onboarding/useOnboarding'
import { useDispatch } from 'react-redux'
import { rename as renameNavigationTab } from '../../../slices/UI/navigationTabs'
import { selectNameAsString } from '@tonylb/mtw-wml/dist/normalize/selectors/name'
import { EditSchema } from './EditContext'
import { isStandardBookmark, isStandardFeature, isStandardKnowledge, isStandardMap, isStandardRoom, StandardFeature, StandardKnowledge, StandardRoom } from '@tonylb/mtw-wml/dist/standardize/baseClasses'
import TitledBox from '../../TitledBox'
import { schemaOutputToString } from '@tonylb/mtw-wml/dist/schema/utils/schemaOutput/schemaOutputToString'

const WMLComponentAppearance: FunctionComponent<{ ComponentId: string }> = ({ ComponentId }) => {
    const { standardForm, updateSchema } = useLibraryAsset()
    const component: StandardFeature | StandardKnowledge | StandardRoom = useMemo(() => {
        if (ComponentId) {
            const component = standardForm.byId[ComponentId]
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
            exits: [],
            themes: []
        }
    }, [ComponentId, standardForm])
    const { tag } = component
    useOnboardingCheckpoint('navigateRoom', { requireSequence: true, condition: tag === 'Room' })
    useOnboardingCheckpoint('navigateAssetWithImport', { requireSequence: true })
    const onChangeShortName = useCallback((event: any) => {
        if (isStandardRoom(component)) {
            const newValue = event.target.value
            if (newValue) {
                if (component.shortName.id) {
                    updateSchema({
                        type: 'replaceChildren',
                        id: component.shortName.id,
                        children: [{ data: { tag: 'String', value: newValue }, children: [] }]
                    })
                }
                else {
                    updateSchema({
                        type: 'addChild',
                        id: component.id,
                        item: {
                            data: { tag: 'ShortName' },
                            children: [{ data: { tag: 'String', value: newValue }, children: [] }]
                        }
                    })
                }
            }
            else {
                if (component.shortName.id) {
                    updateSchema({
                        type: 'delete',
                        id: component.shortName.id
                    })
                }
            }
        }
    }, [component, updateSchema])

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
        {
            (isStandardRoom(component)) && <EditSchema tag="ShortName" field={component ? component.shortName : { data: { tag: 'ShortName' }, children: [], id: '' }} parentId={component?.id ?? ''}>
                <TitledBox title="Short Name">
                    <DescriptionEditor
                        validLinkTags={[]}
                        placeholder="Enter a short name"
                        toolbar={false}
                    />
                </TitledBox>
            </EditSchema>
        }
        <EditSchema tag="Name" field={component ? component.name : { data: { tag: 'Name' }, children: [], id: '' }} parentId={component?.id ?? ''}>
            <TitledBox title={tag === 'Room' ? "Full Name" : "Name" }>
                <DescriptionEditor
                    validLinkTags={[]}
                    placeholder="Enter a name"
                />
            </TitledBox>
        </EditSchema>
        {
            isStandardRoom(component) && <EditSchema tag="Summary" field={component ? component.summary : { data: { tag: 'Summary' }, children: [], id: '' }} parentId={component?.id ?? ''}>
                <TitledBox title="Summary">
                    <DescriptionEditor
                        validLinkTags={tag === 'Knowledge' ? ['Knowledge'] : ['Action', 'Feature', 'Knowledge']}
                        placeholder="Enter a summary"
                    />
                </TitledBox>
            </EditSchema>
        }
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
    const { assetKey, normalForm, updateSchema, standardForm } = useLibraryAsset()
    const { ComponentId } = useParams<{ ComponentId: string }>()
    const location = useLocation()
    const tag = location.pathname.split('/').slice(-2)[0]
    const componentName = useMemo(() => {
        const component = standardForm.byId[ComponentId]
        if (component) {
            if (isStandardRoom(component)) {
                return schemaOutputToString(component.shortName.children)
            }
            else if (isStandardFeature(component) || isStandardKnowledge(component) || isStandardMap(component)) {
                return schemaOutputToString(component.name.children)
            }
        }
        return ''
    }, [standardForm, ComponentId])
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
