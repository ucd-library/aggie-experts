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

async function main(name = 'projects/326679616213/secrets/ucdavis-iam-api-key') {
  // [START secretmanager_get_secret]
  
  // Instantiates a client
  const client = new SecretManagerServiceClient();

  async function getSecret() {
    const [secret] = await client.getSecret({
      name: name,
    });

    const policy = secret.replication.replication;

    console.info(`Found secret ${secret.name} (${policy})`);
    console.info(secret);

    async function accessSecretVersion() {
        const [version] = await client.accessSecretVersion({
            name: name + '/versions/latest',
        });
    
        // Extract the payload as a string.
        const payload = version.payload.data.toString();
    
        // WARNING: Do not print the secret in a production environment - this
        // snippet is showing how to access the secret material.
        console.info(`Payload: ${payload}`);
      }
        accessSecretVersion();
    }

  getSecret();
  // [END secretmanager_get_secret]
}

const args = process.argv.slice(2);
main(...args).catch(console.error);