#!/bin/bash
set -e
cd /home/rogerkorantenng/dev/Hackathons/sankofa
tar -czf sankofa.spl \
  --transform 's|^splunk_app|sankofa|' \
  splunk_app/
echo "Created sankofa.spl"
ls -lh sankofa.spl
