const puppeteer = require('puppeteer');

async function launchSpaceVR() {
  console.log('Launching spaceVR with Puppeteer...');
  
  try {
    // Launch browser with WebGL and WebXR support
    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: [
        '--start-maximized',
        '--enable-webgl',
        '--enable-webxr',
        '--ignore-certificate-errors',
        '--allow-running-insecure-content',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--enable-unsafe-webgpu'
      ]
    });

    const page = await browser.newPage();
    
    // Set viewport for better experience
    await page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
    });

    console.log('Navigating to https://localhost:8081/...');
    
    // Navigate to the local development server
    await page.goto('https://localhost:8081/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    console.log('spaceVR launched successfully!');
    console.log('Browser will remain open for development...');
    
    // Keep the browser open for development
    // Don't call browser.close() to keep it running
    
  } catch (error) {
    console.error('Failed to launch spaceVR:', error.message);
    console.log('Make sure the development server is running with: npm run dev');
  }
}

launchSpaceVR();