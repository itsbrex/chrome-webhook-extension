#!/usr/bin/env bun

import { mkdir, rm, cp } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const DIST_DIR = 'dist';

// Files and directories to include in the build
const INCLUDE_PATHS = [
  'images/',
  'contentScripts/',
  'popup.js',
  'popup.html',
  'manifest.json',
  'background.js'
];

async function build() {
  try {
    console.log('🏗️  Building Chrome Extension...');
    
    // Clean dist directory
    if (existsSync(DIST_DIR)) {
      await rm(DIST_DIR, { recursive: true, force: true });
      console.log('🧹 Cleaned dist directory');
    }
    
    // Create dist directory
    await mkdir(DIST_DIR, { recursive: true });
    console.log('📁 Created dist directory');
    
    // Copy files and directories
    for (const includePath of INCLUDE_PATHS) {
      const sourcePath = includePath;
      const destPath = path.join(DIST_DIR, includePath);
      
      if (existsSync(sourcePath)) {
        const stats = await lstat(sourcePath);
        if (stats.isDirectory()) {
          // Directory - copy recursively
          await cp(sourcePath, destPath, { recursive: true });
          console.log(`📂 Copied directory: ${sourcePath} → ${destPath}`);
        } else {
          // File - copy directly
          await cp(sourcePath, destPath);
          console.log(`📄 Copied file: ${sourcePath} → ${destPath}`);
        }
      } else {
        console.warn(`⚠️  Warning: ${sourcePath} not found, skipping...`);
      }
    }
    
    console.log('✅ Build completed successfully!');
    console.log(`📦 Extension files packaged in: ${DIST_DIR}/`);
    
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

// Run the build
build();