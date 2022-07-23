The *processUp* directory holds all of the processing functions for a bottom-up pass of
validation and processing on the wmlSchema semantic evaluation.

It contains all functions that can operate knowing only themselves and their direct children.

This is in contrast to the *processingDown* directory, which holds all of the processing functions
for top-down pass of validation and processing (and which contains functions that need to know
themselves and their direct-line parents)
