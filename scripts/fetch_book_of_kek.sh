#!/usr/bin/env bash
# Fetch the Book of Kek (thepepeinc/book-of-kek) into static-site/book-of-kek
# so the Book of Kek viewer (book-of-kek.html) can display it.
# Run from repo root or from static-site: ./scripts/fetch_book_of_kek.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATIC_SITE="$(cd "$SCRIPT_DIR/.." && pwd)"
BOK_DIR="$STATIC_SITE/book-of-kek"
REPO_URL="https://github.com/thepepeinc/book-of-kek"
ARCHIVE_URL="$REPO_URL/archive/refs/heads/master.tar.gz"

cd "$STATIC_SITE"
rm -rf book-of-kek book-of-kek-master
echo "Downloading Book of Kek..."
curl -sL "$ARCHIVE_URL" | tar xz
mv book-of-kek-master book-of-kek
echo "Done. Book of Kek is in $BOK_DIR"
echo "Open book-of-kek.html to view."
