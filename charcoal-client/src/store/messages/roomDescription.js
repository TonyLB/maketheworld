import baseMessage from './base.js'

export class roomDescription extends baseMessage {
    constructor(props = {}) {
        super(props)
        const { Description = 'This is a place.', Name='A place', RoomId, Exits=[], Players=[] } = props
        this.Description = Description
        this.Name = Name
        this.Exits = Exits
        this.RoomId = RoomId
        this.Players = Players
    }
}

export default roomDescription
