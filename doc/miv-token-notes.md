# MIV token notes
```
host="https://auth.library.ucdavis.edu"
  connect="${host}/realms/aggie-experts-miv/protocol/openid-connect/token"

  http --form $connect grant_type=client_credentials client_id=miv client_secret="$secret" | tee token_package.json
```

You can investigate this with `jq . token_package.json`. See the long ttl eg:
```
  token=$(jq -r .access_token token_package.json)

  experts:=https://experts.ucdavis.edu
```

Now you can get some grant info
```
  http ${experts}/api/miv/grants ucdPersonUUID==00021386 Authorization:"Bearer $token"
```