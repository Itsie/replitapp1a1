#!/bin/bash
npx concurrently \
  "node server/dev.js" \
  "cd client && npx vite --port 5173 --host 0.0.0.0"
