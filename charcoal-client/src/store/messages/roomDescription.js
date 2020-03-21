import baseMessage from './base.js'

export class roomDescription extends baseMessage {
    constructor(props = {}) {
        super(props)
        const { description = 'This is a place.', name='A place', roomId, exits=[], players=[] } = props
        this.description = description
        this.name = name
        this.exits = exits
        this.roomId = roomId
        this.players = players
    }
}

export default roomDescription
