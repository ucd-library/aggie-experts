#! /usr/bin/env -S node --no-warnings

import ElementsClient from '../lib/elements-client.js';

//console.log(ElementsClient.info('qa'));

let users = {quinn:42956,
             jrmerz:95993
            };

let quinn = await ElementsClient.impersonate(users.quinn,{instance: 'qa'});
//let profile = await quinn.profile();
//console.log('quinn profile');
//console.log(profile.pageData.user);

const privacy={
  objectId: 3746188,
  privacy: "public",
  favourite: true
}

let phone =[
  {
    "fieldId":148,
    "value":[
      {"type":{"id":2,"displayName":"Mobile"},
       "number":"530-675-4278","extension":"",
       "explicitPrivacyLevel":50}
    ]}
];

let resp;
//resp=await quinn.setLinkPrivacy(privacy);
//console.log('setLinkPrivacy\n',resp);

//resp=await quinn.setFavourite(privacy);
//console.log('setFavourite\n',resp);


let jrmerz = await ElementsClient.impersonate(users.jrmerz,{instance: 'qa'});
//profile = await jrmerz.profile();
//console.log('jrmerz profile');
//console.log(JSON.stringify(profile.pageData.user, null, 2));

resp=await jrmerz.setFavourite({
   objectId: 2364120,
   favourite: true
});
console.log('setFavourite\n',resp);
