import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

let scene, camera, renderer, controls;
let cowboy, blaster;
let cowboyMixer;
let weapon, rightHandBone; // Add these variables to track the weapon and bone

// Create debug info panel
function createDebugPanel() {
    const panel = document.createElement('div');
    panel.id = 'debug-panel';
    panel.style.cssText = `
        position: absolute;
        top: 10px;
        left: 10px;
        z-index: 1000;
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 15px;
        border-radius: 8px;
        font-family: monospace;
        font-size: 12px;
        max-width: 300px;
    `;
    panel.innerHTML = `
        <h3 style="margin: 0 0 10px 0; color: #00ff00;">🔫 Cowboy Weapon Test</h3>
        <p style="margin: 0 0 10px 0; color: #aaa;">Mouse: Rotate | Scroll: Zoom</p>
        <div id="coordinates" style="margin: 10px 0; color: #00ff00;"></div>
        <div id="debug-log"></div>
    `;
    document.body.appendChild(panel);
    
    // Create coordinates display
    const coordinates = document.getElementById('coordinates');
    coordinates.textContent = 'Rotation: X: 0.00, Y: 0.00, Z: 0.00';
    
    return document.getElementById('debug-log');
}

function updateCoordinateDisplay() {
    // Function kept for compatibility but no longer updates in real-time
    if (weapon) {
        const coordinates = document.getElementById('coordinates');
        if (coordinates) {
            // Convert radians to degrees for display
            const x = (weapon.rotation.x * 180 / Math.PI).toFixed(2);
            const y = (weapon.rotation.y * 180 / Math.PI).toFixed(2);
            const z = (weapon.rotation.z * 180 / Math.PI).toFixed(2);
            coordinates.textContent = `Rotation: X: ${x}°, Y: ${y}°, Z: ${z}°`;
        }
    }
}

function log(message, color = '#fff') {
    const debugLog = document.getElementById('debug-log');
    if (debugLog) {
        const div = document.createElement('div');
        div.style.color = color;
        div.textContent = message;
        debugLog.appendChild(div);
        console.log(message);
    }
}

function init() {
    // Create debug panel first
    createDebugPanel();
    log('🚀 Initializing test scene...', '#00ff00');

    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x001122);
    log('✓ Scene created');

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(3, 2, 3);
    log('✓ Camera positioned');

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x001122);
    document.body.appendChild(renderer.domElement);
    log('✓ Renderer created');

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 1, 0); // Look at cowboy's chest level
    log('✓ Controls enabled');

    // Lighting setup
    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 3);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Add another light for better visibility
    const pointLight = new THREE.PointLight(0xffffff, 2, 100);
    pointLight.position.set(2, 3, 2);
    scene.add(pointLight);
    
    log('✓ Lighting setup complete');

    // Add ground plane with grid
    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new THREE.MeshLambertMaterial({ 
        color: 0x333333,
        transparent: true,
        opacity: 0.8
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Add grid helper
    const gridHelper = new THREE.GridHelper(20, 20, 0x666666, 0x444444);
    scene.add(gridHelper);
    
    log('✓ Ground and grid added');

    // Load models
    loadModels();

    // Start animation loop
    animate();

    // Handle window resize
    window.addEventListener('resize', onWindowResize);
}

function loadModels() {
    const loader = new GLTFLoader();
    log('🔄 Loading revolver model...', '#ffaa00');

    // Load revolver first
    loader.load('assets/revolver.glb', 
        (gltf) => {
            blaster = gltf.scene;
            log('✓ Revolver loaded successfully', '#00ff00');
            
            // Debug revolver structure
            let meshCount = 0;
            blaster.traverse((child) => {
                if (child.isMesh) {
                    meshCount++;
                    log(`  - Mesh: ${child.name || 'unnamed'}`);
                }
            });
            log(`  Total meshes in revolver: ${meshCount}`);
            
            // Load cowboy after revolver is loaded
            loadCowboy();
        },
        (progress) => {
            log(`Revolver loading: ${Math.round(progress.loaded / progress.total * 100)}%`);
        },
        (error) => {
            log('✗ Error loading revolver: ' + error.message, '#ff0000');
            console.error('Revolver loading error:', error);
        }
    );
}

function loadCowboy() {
    const loader = new GLTFLoader();
    log('🔄 Loading cowboy model...', '#ffaa00');

    loader.load('assets/cowboy1.glb',
        (gltf) => {
            log('✓ Cowboy loaded successfully', '#00ff00');
            log(`  Animations found: ${gltf.animations.length}`);

            // Clone the cowboy (important for animations)
            cowboy = SkeletonUtils.clone(gltf.scene);
            cowboy.position.set(0, 0, 0);
            cowboy.scale.setScalar(1.2);
            cowboy.castShadow = true;
            cowboy.receiveShadow = true;
            scene.add(cowboy);

            log('✓ Cowboy added to scene');

            // Setup animations - use TPose (no animation)
            if (gltf.animations && gltf.animations.length > 0) {
                cowboyMixer = new THREE.AnimationMixer(cowboy);
                
                log(`Available animations: ${gltf.animations.map(anim => anim.name).join(', ')}`);
                
                // Look for TPose animation
                let tposeAnimation = null;
                
                for (const animation of gltf.animations) {
                    const animName = animation.name.toLowerCase();
                    log(`  - ${animation.name}`);
                    
                    // Look for TPose animation
                    if (animName.includes('tpose') || animName.includes('t-pose')) {
                        tposeAnimation = animation;
                        break;
                    }
                }
                
                // If TPose is found, use it as a static pose
                if (tposeAnimation) {
                    const tposeAction = cowboyMixer.clipAction(tposeAnimation);
                    tposeAction.setLoop(THREE.LoopOnce, 1);
                    tposeAction.clampWhenFinished = true;
                    tposeAction.play();
                    log(`✓ Playing TPose animation: ${tposeAnimation.name}`, '#00ff00');
                } else {
                    log('⚠ No TPose animation found, using default pose', '#ffaa00');
                }
            }

            // Attach weapon after a short delay
            setTimeout(() => {
                attachWeaponToCowboy();
            }, 200);

        },
        (progress) => {
            log(`Cowboy loading: ${Math.round(progress.loaded / progress.total * 100)}%`);
        },
        (error) => {
            log('✗ Error loading cowboy: ' + error.message, '#ff0000');
            console.error('Cowboy loading error:', error);
        }
    );
}

function attachWeaponToCowboy() {
    if (!cowboy || !blaster) {
        log('✗ Cowboy or blaster not ready', '#ff0000');
        return;
    }

    log('🔧 Attaching weapon to cowboy...', '#ffaa00');
    
    // Use the actual revolver model
    weapon = blaster.clone(); // Store in global variable
    
    // Scale the revolver to 20% of its original size
    weapon.scale.setScalar(0.2);
    
    // Set the revolver rotation to exactly -30, 80, 30 degrees
    weapon.rotation.x = -30 * Math.PI / 180; // Convert degrees to radians
    weapon.rotation.y = 80 * Math.PI / 180;
    weapon.rotation.z = 30 * Math.PI / 180;
    
    // Log all bones
    const allBones = [];
    
    cowboy.traverse((child) => {
        if (child.isBone) {
            allBones.push(child.name);
            const boneName = child.name.toLowerCase();
            
            // Try multiple naming conventions for right hand bones
            if ((boneName.includes('hand') && (boneName.includes('right') || boneName.includes('r'))) ||
                boneName.includes('r_hand') || 
                boneName.includes('hand_r') ||
                boneName === 'rhand') {
                rightHandBone = child; // Store in global variable
                log(`✓ Found right hand bone: ${child.name}`, '#00ff00');
            }
        }
    });
    
    log(`Skeleton bones (${allBones.length}): ${allBones.join(', ')}`);
    
    // Add weapon to scene (not to bone)
    scene.add(weapon);
    log('🔧 Added revolver model to scene (not to bone)', '#ffff00');
    
    // Log final position
    const worldPos = new THREE.Vector3();
    if (rightHandBone) {
        rightHandBone.getWorldPosition(worldPos);
    } else {
        worldPos.set(0.8, 1.2, 0.4); // Fallback position
    }
    log(`✓ Weapon target position: (${worldPos.x.toFixed(2)}, ${worldPos.y.toFixed(2)}, ${worldPos.z.toFixed(2)})`, '#00ff00');
    
    // Position weapon at target position
    weapon.position.copy(worldPos);
    
    // Initialize coordinate display
    updateCoordinateDisplay();
}

function animate() {
    requestAnimationFrame(animate);
    
    controls.update();
    
    if (cowboyMixer) {
        cowboyMixer.update(0.016);
    }
    
    // Update weapon position to match right hand bone
    if (weapon && rightHandBone) {
        const worldPos = new THREE.Vector3();
        rightHandBone.getWorldPosition(worldPos);
        
        // Apply offset to position the revolver properly in the hand
        weapon.position.copy(worldPos);
        weapon.position.x += 0.05; // Move slightly to the right
        weapon.position.y += 0.02; // Move slightly up
        weapon.position.z += 0.02; // Move slightly forward
    }
    
    // Update coordinate display
    updateCoordinateDisplay();
    
    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Apply dark styling to body
document.body.style.margin = '0';
document.body.style.padding = '0';
document.body.style.background = '#000';
document.body.style.fontFamily = 'Arial, sans-serif';

// Start the application
init();