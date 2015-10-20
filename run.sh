#!/bin/bash

nohup ruby clusterviz.rb -e production >> clusterviz.log 2>&1 &
echo $! > pid.txt