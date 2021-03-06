import baseMessage from './base.js'

export class neighborhoodDescription extends baseMessage {
    constructor(props = {}) {
        super(props)
        const { MessageId, Description = 'This is a place.', Name='A place', NeighborhoodId, PermanentId, Target } = props
        this.MessageId = MessageId
        this.Description = Description
        this.Name = Name
        this.NeighborhoodId = NeighborhoodId || PermanentId
        this.Target = Target
    }
}

export default neighborhoodDescription
