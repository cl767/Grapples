import { physics } from './physics.js';

export class Player {
    constructor(camera, targets) {
        this.camera = camera;
        this.targets = targets;

        // Movement Physics Parameters
        this.velocity = new THREE.Vector3();
        this.acceleration = 0.08;
        this.maxWalkSpeed = 0.25;
        this.maxSprintSpeed = 0.45;
        this.friction = 0.85;

        // State
        this.moveState = { forward: false, backward: false, left: false, right: false, sprint: false };
        this.isCrouched = false;
        this.isSliding = false;
        this.slideVelocity = new THREE.Vector3();

        // Dimensions
        this.normalHeight = 4.0;
        this.crouchHeight = 2.2;
        this.currentEyeHeight = this.normalHeight;
        this.playerRadius = 0.8;
        this.maxStepHeight = 1.0;

        // Gravity & Jump
        this.velocityY = 0;
        this.gravity = -0.02;
        this.jumpStrength = 0.35;
        this.isGrounded = false;

        // Raycasters
        this.downRaycaster = new THREE.Raycaster();

        this.initListeners();
    }

    initListeners() {
        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyW') this.moveState.forward = true;
            if (e.code === 'KeyS') this.moveState.backward = true;
            if (e.code === 'KeyA') this.moveState.left = true;
            if (e.code === 'KeyD') this.moveState.right = true;
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.moveState.sprint = true;
            
            // Crouch & Slide (C)
            if (e.code === 'KeyC') {
                if (this.moveState.sprint && this.isGrounded && !this.isSliding && this.velocity.length() > 0.2) {
                    this.isSliding = true;
                    this.slideVelocity.copy(this.velocity).normalize().multiplyScalar(0.75);
                    this.isCrouched = true;
                } else {
                    this.isCrouched = true;
                }
            }

            // Jump / Slide-Break (Space)
            if (e.code === 'Space') {
                if (this.isSliding) {
                    this.isSliding = false;
                    this.slideVelocity.set(0, 0, 0);
                } else if (this.isGrounded) {
                    this.velocityY = this.jumpStrength;
                    this.isGrounded = false;
                    this.isSliding = false;
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            if (e.code === 'KeyW') this.moveState.forward = false;
            if (e.code === 'KeyS') this.moveState.backward = false;
            if (e.code === 'KeyA') this.moveState.left = false;
            if (e.code === 'KeyD') this.moveState.right = false;
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.moveState.sprint = false;
            
            if (e.code === 'KeyC') {
                this.isCrouched = false;
                this.isSliding = false;
            }
        });
    }

    update(isGrappling) {
        // Smoothly transition eye height
        const targetHeight = this.isCrouched ? this.crouchHeight : this.normalHeight;
        this.currentEyeHeight = THREE.MathUtils.lerp(this.currentEyeHeight, targetHeight, 0.15);

        // Movement vectors
        const dir = new THREE.Vector3();
        this.camera.getWorldDirection(dir);
        dir.y = 0;
        dir.normalize();

        const sideDir = new THREE.Vector3(-dir.z, 0, dir.x);
        let moveDir = new THREE.Vector3(0, 0, 0);
        if (this.moveState.forward) moveDir.add(dir);
        if (this.moveState.backward) moveDir.sub(dir);
        if (this.moveState.left) moveDir.sub(sideDir);
        if (this.moveState.right) moveDir.add(sideDir);
        moveDir.normalize();

        if (isGrappling) {
            this.isSliding = false;
            this.velocity.set(0, 0, 0);
            return;
        }

        // Sliding vs Normal Momentum
        if (this.isSliding) {
            this.slideVelocity.multiplyScalar(0.96);

            const xSlide = new THREE.Vector3(this.slideVelocity.x, 0, 0);
            if (!physics.checkWallCollision(this.camera, this.targets, xSlide, this.currentEyeHeight, this.maxStepHeight, this.playerRadius)) {
                this.camera.position.add(xSlide);
            } else {
                this.slideVelocity.x = 0;
            }

            const zSlide = new THREE.Vector3(0, 0, this.slideVelocity.z);
            if (!physics.checkWallCollision(this.camera, this.targets, zSlide, this.currentEyeHeight, this.maxStepHeight, this.playerRadius)) {
                this.camera.position.add(zSlide);
            } else {
                this.slideVelocity.z = 0;
            }

            if (this.slideVelocity.length() < 0.05 || !this.isGrounded) {
                this.isSliding = false;
            }
        } else {
            const targetSpeed = this.isCrouched ? this.maxWalkSpeed * 0.6 : (this.moveState.sprint ? this.maxSprintSpeed : this.maxWalkSpeed);
            if (moveDir.length() > 0) {
                this.velocity.add(moveDir.multiplyScalar(this.acceleration));
                if (this.velocity.length() > targetSpeed) {
                    this.velocity.normalize().multiplyScalar(targetSpeed);
                }
            } else {
                this.velocity.multiplyScalar(this.friction);
            }

            if (this.velocity.length() > 0.001) {
                const xStep = new THREE.Vector3(this.velocity.x, 0, 0);
                if (!physics.checkWallCollision(this.camera, this.targets, xStep, this.currentEyeHeight, this.maxStepHeight, this.playerRadius)) {
                    this.camera.position.add(xStep);
                } else {
                    this.velocity.x = 0;
                }

                const zStep = new THREE.Vector3(0, 0, this.velocity.z);
                if (!physics.checkWallCollision(this.camera, this.targets, zStep, this.currentEyeHeight, this.maxStepHeight, this.playerRadius)) {
                    this.camera.position.add(zStep);
                } else {
                    this.velocity.z = 0;
                }
            }
        }

        // Gravity & Ground Check
        this.velocityY += this.gravity;
        this.camera.position.y += this.velocityY;

        const groundResult = physics.updateGroundCollision(
            this.camera, this.targets, this.downRaycaster, 
            this.currentEyeHeight, this.maxStepHeight, this.velocityY, this.isGrounded
        );
        this.isGrounded = groundResult.isGrounded;
        this.velocityY = groundResult.velocityY;
    }
}