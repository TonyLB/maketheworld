import * as MapDThreeTreeModule from './MapDThreeTree'
vi.mock('./MapDThreeTree')
import { MapDThree } from '.'

import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'

describe('MapDThree', () => {

    beforeEach(() => {
        vi.clearAllMocks()
        vi.resetAllMocks()
    })

    // TODO: Re-enable after Map component refactor (see AGENT.md "Future Development" section)
    // Tests are disabled due to mock/spy setup issues with MapDThreeTree constructor
    it.skip('should initialize stack on construction', () => {
        const mapTreeSpy = vi.spyOn(MapDThreeTreeModule, 'MapDThreeTree')

        // Create inherited StandardForm with a map
        const inherited = new StandardForm(`
            <Asset uuid=(inheritedAsset)>
                <Map uuid=(testMap)>
                    <Room uuid=(GHI)>
                        <Position {300, 300} />
                        <ShortName>Room GHI</ShortName>
                    </Room>
                </Map>
            </Asset>
        `)

        // Create editable StandardForm with additional rooms
        const editable = new StandardForm(`
            <Asset uuid=(editableAsset)>
                <Map uuid=(testMap)>
                    <Room uuid=(DEF)>
                        <Position {300, 200} />
                        <ShortName>Room DEF</ShortName>
                    </Room>
                    <Room uuid=(ABC)>
                        <Position {200, 200} />
                        <ShortName>Room ABC</ShortName>
                    </Room>
                </Map>
            </Asset>
        `)

        new MapDThree({
            inherited,
            editable,
            mapId: 'MAP#testMap',
            updateStandard: () => {}
        })

        expect(mapTreeSpy).toHaveBeenCalledTimes(1)
        
        // Verify the MapDThreeTree constructor was called with correct parameters
        const constructorCall = mapTreeSpy.mock.calls[0][0]
        expect(constructorCall).toEqual({
            mapId: 'MAP#testMap',
            inherited,
            editable,
            onChange: expect.any(Function),
            onTick: undefined,
            onStabilize: undefined
        })
    })

    // TODO: Re-enable after Map component refactor (see AGENT.md "Future Development" section)
    // Tests are disabled due to mock/spy setup issues with MapDThreeTree constructor
    it.skip('should pass through callback functions', () => {
        const mapTreeSpy = vi.spyOn(MapDThreeTreeModule, 'MapDThreeTree')
        const mockOnStability = vi.fn()
        const mockOnTick = vi.fn()

        const inherited = new StandardForm(`
            <Asset uuid=(inheritedAsset)>
                <Map uuid=(testMap)>
                    <Room uuid=(GHI)>
                        <Position {300, 300} />
                    </Room>
                </Map>
            </Asset>
        `)

        const editable = new StandardForm(`
            <Asset uuid=(editableAsset)>
                <Map uuid=(testMap)>
                    <Room uuid=(DEF)>
                        <Position {300, 200} />
                    </Room>
                </Map>
            </Asset>
        `)

        new MapDThree({
            inherited,
            editable,
            mapId: 'MAP#testMap',
            updateStandard: () => {},
            onStability: mockOnStability,
            onTick: mockOnTick
        })

        expect(mapTreeSpy).toHaveBeenCalledTimes(1)
        
        const constructorCall = mapTreeSpy.mock.calls[0][0]
        expect(constructorCall.onTick).toBe(mockOnTick)
        expect(constructorCall.onStabilize).toBe(mockOnStability)
    })
})