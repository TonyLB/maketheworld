import { render } from '@testing-library/react'
import React from 'react'
import { Provider } from 'react-redux'
import configureStore from 'redux-mock-store'
import LibraryAsset, { useLibraryAsset, AssetComponent } from './LibraryAsset'

jest.mock('../../../cacheDB')
jest.mock('../../../lib/wmlQueryCache')
import { wmlQueryFromCache } from '../../../lib/wmlQueryCache'
import { WMLQuery } from '@tonylb/mtw-wml/dist/wmlQuery'

const wmlQueryFromCacheMock = wmlQueryFromCache as jest.Mock

const mockStore = configureStore()
const currentWML = `
<Asset key=(Test) fileName="test">
    <Import from=(BASE)>
        <Use key=(basePower) type="Variable" as=(power) />
        <Use key=(DEF) type="Room" />
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
        <Exit from=(DEF)>vortex</Exit>
    </Room>
    <Condition if={open}>
        <Depend on=(open) />
        <Room key=(ABC)>
            <Exit to=(DEF)>welcome</Exit>
        </Room>
    </Condition>
    <Room key=(DEF)>
        <Name>Welcome</Name>
    </Room>
    <Variable key=(open) default={false} />
    <Action key=(toggleOpen) src={open = !open} />
</Asset>
`

const store = mockStore({
   personalAssets: {
       byId: {
           ['ASSET#Test']: {
               publicData: {
                   originalWML: currentWML,
                   currentWML,
                   defaultAppearances: {
                       DEF: {
                           render: [{
                               tag: 'String',
                               value: 'A welcome area'
                           }],
                           contents: []
                       }
                   }
               },
               meta: {
                   currentState: 'FRESH',
                   desiredStates: ['FRESH', 'DIRTY']
               }
           }
       }
   }
})

describe('LibraryAsset context provider', () => {

    beforeEach(() => {
        store.clearActions()
        jest.clearAllMocks()
        jest.resetAllMocks()
        wmlQueryFromCacheMock.mockReturnValue(
            new WMLQuery(currentWML)
        )
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
            return <div>{ JSON.stringify(normalForm, null, 4) }</div>
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
            return <div>
                <span>{name.map((item) => ((item.tag === 'String') ? item.value : ''))}</span>
                { render.map((room, index) => {
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
                <span>{name.map((item) => ((item.tag === 'String') ? item.value : ''))}</span>
                { render.map((room, index) => {
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
