#!/bin/bash

kill $(<"pid.txt")
rm pid.txt