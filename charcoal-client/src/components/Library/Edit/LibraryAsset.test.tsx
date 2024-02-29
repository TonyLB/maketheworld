import { render } from '@testing-library/react'
import React from 'react'
import { Provider } from 'react-redux'
import configureStore from 'redux-mock-store'
import LibraryAsset, { useLibraryAsset, AssetComponent } from './LibraryAsset'

jest.mock('../../../cacheDB')
import Normalizer from '@tonylb/mtw-wml/dist/normalize'
import { Schema } from '@tonylb/mtw-wml/dist/schema'
import standardizeSchema from '@tonylb/mtw-wml/dist/schema/standardize'
import { GenericTree } from '@tonylb/mtw-wml/dist/tree/baseClasses'
import { SchemaOutputTag } from '@tonylb/mtw-wml/dist/schema/baseClasses'
import { stripIdFromNormal } from '@tonylb/mtw-wml/dist/normalize/genericId'

const mockStore = configureStore()
const currentWML = `
<Asset key=(Test)>
    <Import from=(BASE)>
        <Variable key=(basePower) as=(power) />
        <Room key=(DEF) />
    </Import>
    <Feature key=(clockTower)>
        <Description>
            A worn stone clock tower.
        </Description>
    </Feature>
    <Room key=(ABC)>
        <Name>Vortex</Name>
        <Description>
            Vortex
            <Link to=(toggleOpen)>(toggle)</Link>
        </Description>
    </Room>
    <If {open}>
        <Room key=(ABC)>
            <Exit to=(DEF)>welcome</Exit>
        </Room>
    </If>
    <Room key=(DEF)>
        <Name>Welcome</Name>
        <Exit to=(ABC)>vortex</Exit>
    </Room>
    <Variable key=(open) default={false} />
    <Action key=(toggleOpen) src={open = !open} />
</Asset>
`
const schemaConvert = new Schema()
schemaConvert.loadWML(currentWML)
const baseSchema = schemaConvert.schema

const inheritedSchema = new Schema()
inheritedSchema.loadWML(`<Asset key=(Test)>
    <Inherited>
        <Room key=(DEF)>
            <Description>A welcome area</Description>
        </Room>
    </Inherited>
</Asset>`)

const schema = standardizeSchema(inheritedSchema.schema, baseSchema)
const normalizer = new Normalizer()
normalizer.loadSchema(schema)

const store = mockStore({
    personalAssets: {
       byId: {
           ['ASSET#Test']: {
                publicData: {
                    originalWML: currentWML,
                    currentWML,
                    baseSchema,
                    schema,
                    normal: normalizer.normal,
                    importDefaults: {},
                    importData: {
                        BASE: inheritedSchema.schema
                    }
                },
                meta: {
                   currentState: 'FRESH',
                   desiredStates: ['FRESH', 'WMLDIRTY', 'SCHEMADIRTY']
                }
           }
       }
    },
    player: {}
})

describe('LibraryAsset context provider', () => {

    beforeEach(() => {
        store.clearActions()
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should provide currentWML', () => {
        const TestComponent = () => {
            const { currentWML } = useLibraryAsset()
            return <div>{ currentWML }</div>
        }
        const { container } = render(
            <Provider store={store}>
                <LibraryAsset assetKey='Test' >
                    <TestComponent />
                </LibraryAsset>
            </Provider>
        )
        expect(container.textContent).toMatchSnapshot()

    })

    it('should provide normalForm', () => {
        const TestComponent = () => {
            const { normalForm } = useLibraryAsset()
            return <div>{ JSON.stringify(stripIdFromNormal(normalForm), null, 4) }</div>
        }
        const { container } = render(
            <Provider store={store}>
                <LibraryAsset assetKey='Test' >
                    <TestComponent />
                </LibraryAsset>
            </Provider>
        )
        expect(container.textContent).toMatchSnapshot()

    })

    it('should provide rooms', ()=>{
        const RoomComponent = ({ value }: { value: AssetComponent }) => {
            const { name, render } = value
            const recursiveRender = (tree: GenericTree<SchemaOutputTag>) => (
                <React.Fragment>
                    { tree.map(({ data: room, children }, index) => {
                        switch(room.tag) {
                            case 'String':
                                return <React.Fragment key={index}>
                                    <span>String</span>
                                    <span>{ room.value }</span>
                                </React.Fragment>
                            case 'Link': 
                                return <React.Fragment key={index}>
                                    <span>Link</span>
                                    <span>{ room.to }</span>
                                </React.Fragment>
                            case 'Inherited':
                                return <React.Fragment key={index}>
                                    <span>Inherited</span>
                                    <span>{ recursiveRender(children) }</span>
                                </React.Fragment>
                            default:
                                return null
                        }
                        
                    })}
                </React.Fragment>
            )
            return <div>
                <span>{name.map(({ data: item }) => ((item.tag === 'String') ? item.value : ''))}</span>
                { recursiveRender(render) }
            </div>
        }
        const TestComponent = () => {
            const { rooms } = useLibraryAsset()
            return <div>{ Object.entries(rooms).map(([key, value]) => (<RoomComponent key={key} value={value} />)) }</div>
        }
        const { container } = render(
            <Provider store={store}>
                <LibraryAsset assetKey='Test' >
                    <TestComponent />
                </LibraryAsset>
            </Provider>
        )
        expect(container).toMatchSnapshot()

    })

    it('should provide features', ()=>{
        const FeatureComponent = ({ value }: { value: AssetComponent }) => {
            const { name, render } = value
            return <div>
                <span>{name.map(({ data: item }) => ((item.tag === 'String') ? item.value : ''))}</span>
                { render.map(({ data: room }, index) => {
                    switch(room.tag) {
                        case 'String':
                            return <React.Fragment key={index}>
                                <span>String</span>
                                <span>{ room.value }</span>
                            </React.Fragment>
                        case 'Link': 
                            return <React.Fragment key={index}>
                                <span>Link</span>
                                <span>{ room.to }</span>
                            </React.Fragment>
                        default:
                            return null
                    }
                })}
            </div>
        }
        const TestComponent = () => {
            const { features } = useLibraryAsset()
            return <div>{ Object.entries(features).map(([key, value]) => (<FeatureComponent key={key} value={value} />)) }</div>
        }
        const { container } = render(
            <Provider store={store}>
                <LibraryAsset assetKey='Test' >
                    <TestComponent />
                </LibraryAsset>
            </Provider>
        )
        expect(container).toMatchSnapshot()

    })

})
