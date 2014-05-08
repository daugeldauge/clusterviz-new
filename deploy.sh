#!/bin/bash

sftp daugeldauge@graphit.parallel.ru <<EOF
cd clusterviz
put clusterviz.rb
put config.rb
put -r public
put -r src
put -r views
EOF

echo "Deploying has ended sucessfully."