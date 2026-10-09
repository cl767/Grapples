export const physics = {
    checkWallCollision(camera, targets, moveVector, currentEyeHeight, maxStepHeight, playerRadius) {
        if (targets.length === 0 || moveVector.length() === 0) return false;
        
        const direction = moveVector.clone().normalize();
        const checkPos = camera.position.clone();
        checkPos.y -= (currentEyeHeight - maxStepHeight);

        const wallRaycaster = new THREE.Raycaster(checkPos, direction, 0, playerRadius + 0.1);
        const intersects = wallRaycaster.intersectObjects(targets, true);
        return intersects.length > 0;
    },

    updateGroundCollision(camera, targets, downRaycaster, currentEyeHeight, maxStepHeight, velocityY, isGrounded) {
        if (targets.length === 0) return { isGrounded, velocityY };

        downRaycaster.set(camera.position, new THREE.Vector3(0, -1, 0));
        downRaycaster.far = 100;
        const floorIntersects = downRaycaster.intersectObjects(targets, true);

        if (floorIntersects.length > 0) {
            const hit = floorIntersects[0];
            const targetY = hit.point.y + currentEyeHeight;

            if (velocityY <= 0 && camera.position.y <= targetY + 1.0) {
                const heightDiff = targetY - camera.position.y;
                
                if (heightDiff <= maxStepHeight + 0.5) {
                    camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetY, 0.4);
                    if (Math.abs(camera.position.y - targetY) < 0.05) {
                        camera.position.y = targetY;
                    }
                    return { isGrounded: true, velocityY: 0 };
                } else if (heightDiff < 4.0 && isGrounded) {
                    return { isGrounded: true, velocityY };
                }
            }
        }
        return { isGrounded: false, velocityY };
    }
};