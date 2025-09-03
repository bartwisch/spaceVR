import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

let scene, camera, renderer, controls;
let cowboy, blaster;
let cowboyMixer;

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
        <div id="debug-log"></div>
    `;
    document.body.appendChild(panel);
    return document.getElementById('debug-log');
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
    log('🔄 Loading blaster model...', '#ffaa00');

    // Load blaster first
    loader.load('assets/blaster.glb', 
        (gltf) => {
            blaster = gltf.scene;
            log('✓ Blaster loaded successfully', '#00ff00');
            
            // Debug blaster structure
            let meshCount = 0;
            blaster.traverse((child) => {
                if (child.isMesh) {
                    meshCount++;
                    log(`  - Mesh: ${child.name || 'unnamed'}`);
                }
            });
            log(`  Total meshes in blaster: ${meshCount}`);
            
            // Load cowboy after blaster is loaded
            loadCowboy();
        },
        (progress) => {
            log(`Blaster loading: ${Math.round(progress.loaded / progress.total * 100)}%`);
        },
        (error) => {
            log('✗ Error loading blaster: ' + error.message, '#ff0000');
            console.error('Blaster loading error:', error);
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

            // Setup animations - find the best idle animation
            if (gltf.animations && gltf.animations.length > 0) {
                cowboyMixer = new THREE.AnimationMixer(cowboy);
                
                log(`Available animations: ${gltf.animations.map(anim => anim.name).join(', ')}`);
                
                // Find best animation (avoid death animations)
                let bestAnimation = gltf.animations[0]; // fallback to first
                
                for (const animation of gltf.animations) {
                    const animName = animation.name.toLowerCase();
                    log(`  - ${animation.name}`);
                    
                    // Prefer idle/wave animations, avoid death animations
                    if (animName.includes('wave') || animName.includes('wink') || animName.includes('greeting')) {
                        bestAnimation = animation;
                        break;
                    } else if (animName.includes('idle') && !animName.includes('dead')) {
                        bestAnimation = animation;
                    } else if (!animName.includes('dead') && !animName.includes('death')) {
                        // Any non-death animation is better than death
                        if (bestAnimation.name.toLowerCase().includes('dead') || 
                            bestAnimation.name.toLowerCase().includes('death')) {
                            bestAnimation = animation;
                        }
                    }
                }
                
                const idleAction = cowboyMixer.clipAction(bestAnimation);
                idleAction.setLoop(THREE.LoopRepeat, Infinity);
                idleAction.play();
                log(`✓ Playing animation: ${bestAnimation.name}`, '#00ff00');
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
    
    const cowboyWeapon = blaster.clone();
    
    // Log all bones
    let rightHandBone = null;
    const allBones = [];
    
    cowboy.traverse((child) => {
        if (child.isBone) {
            allBones.push(child.name);
            const boneName = child.name.toLowerCase();
            
            if (boneName.includes('hand') && (boneName.includes('right') || boneName.includes('r'))) {
                rightHandBone = child;
                log(`✓ Found right hand bone: ${child.name}`, '#00ff00');
            }
        }
    });
    
    log(`Skeleton bones (${allBones.length}): ${allBones.join(', ')}`);
    
    // Make weapon VERY visible for testing
    cowboyWeapon.scale.setScalar(3.0); // Huge weapon
    log('✓ Weapon scaled to 3.0x size');
    
    if (rightHandBone) {
        log(`✓ Attaching to right hand bone: ${rightHandBone.name}`, '#00ff00');
        
        // Position weapon in hand
        cowboyWeapon.position.set(0, -0.2, 0.2);
        cowboyWeapon.rotation.set(0, Math.PI/2, 0);
        
        rightHandBone.add(cowboyWeapon);
        
    } else {
        log('⚠ No right hand bone found, using fallback', '#ffaa00');
        
        // Fallback: attach to cowboy directly at hand position
        cowboyWeapon.position.set(0.8, 1.2, 0.4);
        cowboyWeapon.rotation.set(0, Math.PI/2, 0);
        cowboy.add(cowboyWeapon);
    }
    
    // Make weapon super visible with bright materials
    let meshCount = 0;
    cowboyWeapon.traverse((child) => {
        if (child.isMesh) {
            meshCount++;
            // Create super bright red material
            child.material = new THREE.MeshStandardMaterial({
                color: 0xff0000,
                emissive: 0x660000,
                metalness: 0.8,
                roughness: 0.2
            });
            child.castShadow = true;
            child.receiveShadow = true;
            log(`  - Weapon mesh ${meshCount}: ${child.name || 'unnamed'} - bright red material applied`);
        }
    });
    
    // Log final position
    const worldPos = new THREE.Vector3();
    cowboyWeapon.getWorldPosition(worldPos);
    log(`✓ Weapon world position: (${worldPos.x.toFixed(2)}, ${worldPos.y.toFixed(2)}, ${worldPos.z.toFixed(2)})`, '#00ff00');
    
    // Add a helper sphere at weapon position for debugging
    const helperGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const helperMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const helper = new THREE.Mesh(helperGeometry, helperMaterial);
    helper.position.copy(worldPos);
    scene.add(helper);
    log('✓ Green helper sphere added at weapon position');
    
    log('🎉 Weapon attachment complete!', '#00ff00');
}

function animate() {
    requestAnimationFrame(animate);
    
    controls.update();
    
    if (cowboyMixer) {
        cowboyMixer.update(0.016);
    }
    
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