// Scene, Camera, Renderer Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111122);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

// Floor
const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshStandardMaterial({ color: 0x333333 })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// Target Boxes to Grapple & Collide Onto
const targets = [];
const boxGeo = new THREE.BoxGeometry(4, 4, 4);
const boxMat = new THREE.MeshStandardMaterial({ color: 0x0077ff });

for (let i = 0; i < 20; i++) {
    const box = new THREE.Mesh(boxGeo, boxMat);
    box.position.set(
        (Math.random() - 0.5) * 70,
        Math.random() * 15 + 3,
        (Math.random() - 0.5) * 70
    );
    scene.add(box);
    targets.push(box);
}

camera.position.set(0, 2, 15);

// Controls & State
const moveState = { forward: false, backward: false, left: false, right: false };
let euler = new THREE.Euler(0, 0, 0, 'YXZ');
const moveSpeed = 0.15;
const playerRadius = 0.8; // Player collision size

// Grapple State
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(0, 0); // center of screen
let grappleTarget = null;

// Pointer Lock for Mouse Look
window.addEventListener('click', () => {
    document.body.requestPointerLock();
});

window.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === document.body) {
        const sensitivity = 0.002;
        euler.y -= e.movementX * sensitivity;
        euler.x -= e.movementY * sensitivity;
        euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
        camera.quaternion.setFromEuler(euler);
    }
});

// Keyboard Movement Listeners
window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyW') moveState.forward = true;
    if (e.code === 'KeyS') moveState.backward = true;
    if (e.code === 'KeyA') moveState.left = true;
    if (e.code === 'KeyD') moveState.right = true;
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyW') moveState.forward = false;
    if (e.code === 'KeyS') moveState.backward = false;
    if (e.code === 'KeyA') moveState.left = false;
    if (e.code === 'KeyD') moveState.right = false;
});

// Right-Click to Grapple
window.addEventListener('mousedown', (e) => {
    if (e.button === 2) {
        e.preventDefault();
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(targets);

        if (intersects.length > 0) {
            grappleTarget = intersects[0].point;
        }
    }
});

window.addEventListener('mouseup', (e) => {
    if (e.button === 2) {
        grappleTarget = null;
    }
});

window.addEventListener('contextmenu', e => e.preventDefault());

// Collision Detection Function
function canMoveTo(pos) {
    if (Math.abs(pos.x) > 48 || Math.abs(pos.z) > 48) return false; // Floor boundary

    for (let box of targets) {
        const bPos = box.position;
        // Box size is 4x4x4 (half-size = 2)
        const minX = bPos.x - 2 - playerRadius;
        const maxX = bPos.x + 2 + playerRadius;
        const minZ = bPos.z - 2 - playerRadius;
        const maxZ = bPos.z + 2 + playerRadius;
        const minY = bPos.y - 2;
        const maxY = bPos.y + 2;

        if (pos.x > minX && pos.x < maxX && pos.z > minZ && pos.z < maxZ && pos.y > minY && pos.y < maxY) {
            return false; // Collision!
        }
    }
    return true;
}

// Game Loop
function animate() {
    requestAnimationFrame(animate);

    // Movement Direction Vectors
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();

    const sideDir = new THREE.Vector3(-dir.z, 0, dir.x);

    let moveDir = new THREE.Vector3(0, 0, 0);
    if (moveState.forward) moveDir.add(dir);
    if (moveState.backward) moveDir.sub(dir);
    if (moveState.left) moveDir.sub(sideDir);   // Fixed A/D strafe inversion
    if (moveState.right) moveDir.add(sideDir); // Fixed A/D strafe inversion
    moveDir.normalize();

    // Apply movement with axis-separated collision sliding
    if (moveDir.length() > 0) {
        const stepX = new THREE.Vector3(moveDir.x * moveSpeed, 0, 0);
        const nextX = camera.position.clone().add(stepX);
        if (canMoveTo(nextX)) camera.position.x = nextX.x;

        const stepZ = new THREE.Vector3(0, 0, moveDir.z * moveSpeed);
        const nextZ = camera.position.clone().add(stepZ);
        if (canMoveTo(nextZ)) camera.position.z = nextZ.z;
    }

    // Grappling Hook Pull Logic
    if (grappleTarget) {
        const pullDir = new THREE.Vector3().subVectors(grappleTarget, camera.position);
        const distance = pullDir.length();
        
        if (distance > 3) {
            pullDir.normalize();
            const nextPullPos = camera.position.clone().addScaledVector(pullDir, 0.4);
            if (canMoveTo(nextPullPos)) {
                camera.position.copy(nextPullPos);
            } else {
                grappleTarget = null; // Stop if colliding mid-grapple
            }
        } else {
            grappleTarget = null;
        }
    }

    renderer.render(scene, camera);
}
animate();

// Window Resizing
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});