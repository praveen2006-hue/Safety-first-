#!/usr/bin/env bash
set -e
curl -fsS "$1/health"
echo
