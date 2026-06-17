import { StandardForm } from '..'
import { deIndentWML } from '../../schema/utils'
import StandardObject from './object'
import StandardRoom from './room'

jest.mock('@tonylb/mtw-utilities/ts/uuid/index', () => {
    return {
        ...jest.requireActual('@tonylb/mtw-utilities/ts/uuid/___mocks___/index')
    }
})

describe('StandardObject ephemeraWire integration', () => {
    it('parses top-level Object under Asset in ephemeraWire', () => {
        const wml = deIndentWML(`
            <Asset uuid=(Test)>
                <Object uuid=(skates)>
                    <ShortName>roller skates</ShortName>
                </Object>
            </Asset>
        `)
        const sf = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const object = sf._lookup('OBJECT#skates') as StandardObject
        expect(object).toBeInstanceOf(StandardObject)
        expect(object.shortName?._payload?.plain?.toJSON()).toBe('roller skates')
        expect(sf._components.filter((c) => c instanceof StandardObject)).toHaveLength(1)
    })

    it('keeps room-nested Object on StandardRoom.objects, not top-level components', () => {
        const wml = deIndentWML(`
            <Asset uuid=(Test)>
                <Room key=(main) uuid=(main)>
                    <Object uuid=(skates)>
                        <ShortName>roller skates</ShortName>
                    </Object>
                </Room>
            </Asset>
        `)
        const sf = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const room = sf._lookup('ROOM#main') as StandardRoom
        expect(room.objects).toEqual([{ uuid: 'OBJECT#skates', shortName: 'roller skates' }])
        expect(sf._components.filter((c) => c instanceof StandardObject)).toHaveLength(0)
    })
})
