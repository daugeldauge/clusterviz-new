#!/bin/bash

kill `ps aux --sort=start_time | grep clusterviz | sed -nr '1s/([^0-9]*([0-9]*)){2}.*/\2/p'`
