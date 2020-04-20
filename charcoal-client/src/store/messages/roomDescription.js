import baseMessage from './base.js'

export class roomDescription extends baseMessage {
    constructor(props = {}) {
        super(props)
        const { Description = 'This is a place.', Name='A place', Ancestry='PLACE', RoomId, PermanentId, Exits=[], Players=[], Recap=[] } = props
        this.Description = Description
        this.Name = Name
        this.Ancestry = Ancestry
        this.Exits = Exits
        this.RoomId = RoomId || PermanentId
        this.Players = Players
        this.Recap = Recap
    }
}

export default roomDescription
