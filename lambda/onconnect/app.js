// Copyright 2020, Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

exports.handler = () => {
  return Promise.resolve({ statusCode: 200, body: 'Connected.' })
}
