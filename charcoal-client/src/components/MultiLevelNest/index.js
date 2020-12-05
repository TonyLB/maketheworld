//
// MultiLevelNest presents a UI pattern for MTW wherein a selection in a panel opens more detail by
// sliding that panel out to the left and sliding the detail panel in on the right.  The component can 
// show any number of levels, but should only be used for successively finer levels of detail.  To show
// a progression through different data items on the same level of detail, use Material-UI Stepper
//

import React from 'react'

export const MultiLevelNest = ({ levelComponents = [], currentLevel = 1 }) => {
    return (
        //
        // A container div that precisely fills the available space, and hides any overflow
        //
        <div
            style={{
                width: "100%",
                height: "100%",
                position: 'relative',
                overflow: 'hidden'
            }}
        >
            {
                //
                // Individual content divs, animated into position within the container
                // depending upon the currentLevel chosen
                //
                levelComponents && levelComponents.map((component, index) => (
                    <div
                        key={`MultiLevel-Content-${index}`}
                        style={{
                            width: "100%",
                            height: "100%",
                            position: "absolute",
                            overflowY: "auto",
                            left: `${(1 + index - currentLevel) * 100}%`,
                            transition: 'left 0.5s ease'
                        }}
                    >
                        {component}
                    </div>
                ))
            }
        </div>
    )
}

export default MultiLevelNest