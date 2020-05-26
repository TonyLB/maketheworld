import baseMessage from './base.js'

export class roomDescription extends baseMessage {
    constructor(props = {}) {
        super(props)
        const { MessageId, Description = 'This is a place.', Name='A place', Ancestry='PLACE', RoomId, PermanentId, Exits=[], Players=[], Recap=[], open=false } = props
        this.MessageId = MessageId
        this.Description = Description
        this.Name = Name
        this.Ancestry = Ancestry
        this.Exits = Exits
        this.RoomId = RoomId || PermanentId
        this.Players = Players
        this.Recap = Recap
        this.open = open
    }

    update (values) {
        return new roomDescription({ ...this, ...values })
    }
}

export default roomDescription
