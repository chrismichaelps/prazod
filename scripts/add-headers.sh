#!/bin/bash

# Header content
HEADER="/**
 * Author: Chris M. Pérez
 * License: MIT
 */"

# Directory to process
TARGET_DIR="src"

# Find all .ts files in src directory
find "$TARGET_DIR" -name "*.ts" | while read -r file; do
    # Check if file already has the header
    if ! grep -q "Author: Chris Perez" "$file"; then
        echo "Adding header to $file"
        
        # Create a temporary file with the header
        echo "$HEADER" > "$file.tmp"
        echo "" >> "$file.tmp"
        
        # Append original file content to temp file
        cat "$file" >> "$file.tmp"
        
        # Replace original file with temp file
        mv "$file.tmp" "$file"
    else
        echo "Header already present in $file"
    fi
done

echo "Done adding headers!"
