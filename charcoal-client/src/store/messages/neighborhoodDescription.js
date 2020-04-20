import baseMessage from './base.js'

export class neighborhoodDescription extends baseMessage {
    constructor(props = {}) {
        super(props)
        const { Description = 'This is a place.', Name='A place', NeighborhoodId, PermanentId } = props
        this.Description = Description
        this.Name = Name
        this.NeighborhoodId = NeighborhoodId || PermanentId
    }
}

export default neighborhoodDescription
