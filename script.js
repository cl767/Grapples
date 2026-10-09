const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111122);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

// Floor & Targets
const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshStandardMaterial({ color: 0x333333 })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

for (let i = 0; i < 15; i++) {
    const box = new THREE.Mesh(
        new THREE.BoxGeometry(4, 4, 4),
        new THREE.MeshStandardMaterial({ color: 0x0077ff })
    );
    box.position.set(
        (Math.random() - 0.5) * 60,
        Math.random() * 15 + 2,
        (Math.random() - 0.5) * 60
    );
    scene.add(box);
}

camera.position.set(0, 2, 10);

// Controls State
const moveState = { forward: false, backward: false, left: false, right: false };
let euler = new THREE.Euler(0, 0, 0, 'YXZ');
const moveSpeed = 0.1;

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

function animate() {
    requestAnimationFrame(animate);

    // Movement logic
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();

    const sideDir = new THREE.Vector3(-dir.z, 0, dir.x);

    if (moveState.forward) camera.position.addScaledVector(dir, moveSpeed);
    if (moveState.backward) camera.position.addScaledVector(dir, -moveSpeed);
    if (moveState.left) camera.position.addScaledVector(sideDir, moveSpeed);
    if (moveState.right) camera.position.addScaledVector(sideDir, -moveSpeed);

    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});