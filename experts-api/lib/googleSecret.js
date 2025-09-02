// Copyright 2019 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

// Instantiates a client
const client = new SecretManagerServiceClient();

export class GoogleSecret {

  constructor() {
    return this;
  }

  async getSecret(name) {
    const [secret] = await client.getSecret({
      name: name,
    });

    async function accessSecretVersion() {
      const [version] = await client.accessSecretVersion({
        name: name + '/versions/latest',
      });

      // Extract the payload as a string.
      const payload = version.payload.data.toString();

      // WARNING: Do not print the secret in a production environment - this
      // snippet is showing how to access the secret material.
      // console.log(`Payload: ${payload}`);
      return payload;
    }
    return accessSecretVersion();
  }
}

export default GoogleSecret;
