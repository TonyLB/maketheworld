The *processing* directory holds all of the processing functions for the first, bottom-up, pass of
validation and pre-processing on the wmlSchema semantic evaluation.

It contains all functions that can operate knowing only themselves and their direct children.

This is in contrast to the *postProcessing* directory, which holds all of the processing functions
for the second, top-down, pass of validation and processing (and which contains functions that
need to know themselves their their direct-line parents)