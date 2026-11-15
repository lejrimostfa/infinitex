// Headless Chromium with a real GPU (WebGPU on, ANGLE Metal for WebGL2).
// Uses the Playwright browser cache, or IX_CHROMIUM if set.

import { chromium } from 'playwright-core';
import { readdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

function findChromium() {

	if ( process.env.IX_CHROMIUM ) return process.env.IX_CHROMIUM;
	const root = join( homedir(), 'Library/Caches/ms-playwright' );
	if ( ! existsSync( root ) ) return undefined;
	const dirs = readdirSync( root ).filter( ( d ) => /^chromium-\d+$/.test( d ) ).sort().reverse();
	for ( const d of dirs ) {

		const app = join( root, d, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' );
		if ( existsSync( app ) ) return app;

	}

	return undefined;

}

export function launchBrowser() {

	return chromium.launch( {
		executablePath: findChromium(),
		headless: true,
		args: [ '--enable-unsafe-webgpu', '--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist' ],
	} );

}
