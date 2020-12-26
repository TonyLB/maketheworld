import React from 'react'
import PropTypes from "prop-types"

//
// MessageTime is a purely semantic (non-rendering) component
// for use as a child in the polymorphic Message component
//
export const MessageTime = ({ time }) => <React.Fragment>
</React.Fragment>

MessageTime.propTypes = {
    time: PropTypes.number
}
export default MessageTime