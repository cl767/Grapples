import { Player } from './player.js';

// Scene, Camera, Renderer Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111122);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
dirLight.position.set(10, 30, 10);
scene.add(dirLight);

// Targets Array
const targets = [];

// Load Map Model
const loader = new THREE.GLTFLoader();
loader.load('models/scene.gltf', (gltf) => {
    const model = gltf.scene;
    model.scale.set(5, 5, 5); 
    model.position.set(0, 0, 0);
    scene.add(model);

    model.traverse((child) => {
        if (child.isMesh) {
            targets.push(child);
        }
    });
    console.log("Custom map loaded successfully with " + targets.length + " collision targets!");
});

camera.position.set(0, 40, 10);

// Initialize Player Module
const player = new Player(camera, targets);

// Mouse Look & Pointer Lock
let euler = new THREE.Euler(0, 0, 0, 'YXZ');
window.addEventListener('click', () => document.body.requestPointerLock());
window.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === document.body) {
        const sensitivity = 0.002;
        euler.y -= e.movementX * sensitivity;
        euler.x -= e.movementY * sensitivity;
        euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
        camera.quaternion.setFromEuler(euler);
    }
});

// Grapple State
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(0, 0);
let grappleTarget = null;

window.addEventListener('mousedown', (e) => {
    if (e.button === 2) {
        e.preventDefault();
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(targets, true);
        if (intersects.length > 0) {
            grappleTarget = intersects[0].point;
            player.isSliding = false;
        }
    }
});

window.addEventListener('mouseup', (e) => {
    if (e.button === 2) grappleTarget = null;
});
window.addEventListener('contextmenu', e => e.preventDefault());

// Game Loop
function animate() {
    requestAnimationFrame(animate);

    let isGrappling = false;
    if (grappleTarget) {
        const pullDir = new THREE.Vector3().subVectors(grappleTarget, camera.position);
        const distance = pullDir.length();
        
        if (distance > 3) {
            pullDir.normalize();
            camera.position.addScaledVector(pullDir, 0.5);
            player.velocityY = 0;
            isGrappling = true;
        } else {
            grappleTarget = null;
        }
    }

    player.update(isGrappling);

    renderer.render(scene, camera);
}
animate();

// Window Resizing
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});