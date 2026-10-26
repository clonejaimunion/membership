#!/bin/bash
# Rebuild the prebuilt Windows update package at /app/release/member_union_update.zip
set -e
cd /app/frontend
rm -rf /root/pkg build
REACT_APP_BACKEND_URL= GENERATE_SOURCEMAP=false yarn build > /root/build.log 2>&1
mkdir -p /root/pkg/backend /root/pkg/frontend
mv build /root/pkg/frontend/build
cd /app
cp -r backend/server.py backend/services backend/requirements-local.txt /root/pkg/backend/
cp -r deploy /root/pkg/
find /root/pkg -name __pycache__ -prune -exec rm -rf {} +
cd /root/pkg && rm -f /root/member_union_update.zip && zip -qr /root/member_union_update.zip .
mv /root/member_union_update.zip /app/release/member_union_update.zip
ls -la /app/release/member_union_update.zip
