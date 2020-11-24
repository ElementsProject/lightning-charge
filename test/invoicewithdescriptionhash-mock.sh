#! /bin/sh

# Eg. {"jsonrpc":"2.0","id":2,"method":"getmanifest","params":{}}\n\n
read -r JSON
read -r _
id=$(echo "$JSON" | jq -r '.id')

echo '{"jsonrpc":"2.0","id":'"$id"',"result":{"dynamic":true,"options":[],"rpcmethods":[{"name":"invoicewithdescriptionhash","usage":"<sat> <label><description_hash>","description":"this is just a worthless broken method for the tests!"}]}}'

# Eg. {"jsonrpc":"2.0","id":5,"method":"init","params":{"options":{},"configuration":{"lightning-dir":"/home/rusty/.lightning","rpc-file":"lightning-rpc","startup":false}}}\n\n
read -r JSON
read -r _
id=$(echo "$JSON" | jq -r '.id')
rpc=$(echo "$JSON" | jq -r '.params.configuration | .["lightning-dir"] + "/" + .["rpc-file"]')

echo '{"jsonrpc":"2.0","id":'"$id"',"result":{}}'

# eg. { "jsonrpc" : "2.0", "method" : "invoicewithdescriptionhash 10sat label descriptionhash", "id" : 6, "params" :[ "hello"] }
while read -r JSON; do
    read -r _
    echo "$JSON" | sed 's/invoicewithdescriptionhash/invoice/' | nc -U $rpc -W 1
done
