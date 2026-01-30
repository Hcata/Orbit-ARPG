import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { BaseCharacter } from './BaseCharacter';
import { soundManager } from './SoundManager';
import { OrbitSystem } from './OrbitSystem';

export class Player extends BaseCharacter {
    public level: number = 1;
    public moveSpeed: number = 7;
    public hasShield: boolean = false;
    private keys: { [key: string]: boolean } = {};
    private shieldMesh: THREE.Mesh | null = null;
    private invulnerabilityTimer: number = 0;
    private playerIndex: number;
    private gamepadIndex: number | null;
    private trailPositions: THREE.Vector3[] = [];
    private trailMeshes: THREE.Mesh[] = [];
    private MAX_TRAIL = 5;
    private trailFadeTimer: number = 0;

    constructor(scene: THREE.Scene, world: CANNON.World, gameScene: any, playerIndex: number = 0, gamepadIndex: number | null = null, color: number = 0x06b6d4, position: THREE.Vector3 = new THREE.Vector3(0, 0, 0)) {
        // Use provided color or default
        super(scene, world, position, color, 'player', gameScene);

        this.playerIndex = playerIndex;
        this.gamepadIndex = gamepadIndex;

        // Register keyboard for all players but they share keys, or we can partition it
        // For simplicity, player 0 uses WASD/Arrows. 
        // We add the listeners once or just check keys.
        window.addEventListener('keydown', (e) => this.keys[e.code] = true);
        window.addEventListener('keyup', (e) => this.keys[e.code] = false);
    }

    public setGamepadIndex(index: number | null) {
        this.gamepadIndex = index;
    }

    public update(deltaTime: number) {
        if (this.isDead) return;

        if (this.invulnerabilityTimer > 0) {
            this.invulnerabilityTimer -= deltaTime;
            // Visual feedback for invulnerability (flicker)
            this.mesh.visible = Math.floor(this.invulnerabilityTimer * 20) % 2 === 0;
        } else {
            this.mesh.visible = true;
        }

        this.handleMovement();
        this.updateTrail(deltaTime);
        super.update(deltaTime);

        if (this.shieldMesh) {
            this.shieldMesh.rotation.z += deltaTime * 2;
        }
    }

    private handleMovement() {
        const vel = new CANNON.Vec3(0, 0, 0);

        // Keyboard movement (only for player 0)
        if (this.playerIndex === 0) {
            if (this.keys['ArrowUp'] || this.keys['KeyW']) vel.y += 1;
            if (this.keys['ArrowDown'] || this.keys['KeyS']) vel.y -= 1;
            if (this.keys['ArrowLeft'] || this.keys['KeyA']) vel.x -= 1;
            if (this.keys['ArrowRight'] || this.keys['KeyD']) vel.x += 1;
        }

        // Gamepad movement
        if (this.gamepadIndex !== null) {
            const gamepads = navigator.getGamepads();
            const gp = gamepads[this.gamepadIndex];
            if (gp) {
                const axisX = gp.axes[0];
                const axisY = gp.axes[1];

                // Deadzone
                if (Math.abs(axisX) > 0.1) vel.x += axisX;
                if (Math.abs(axisY) > 0.1) vel.y -= axisY; // Gamepad Y is inverted
            }
        }

        if (vel.length() > 0) {
            vel.normalize();
            vel.scale(this.moveSpeed, vel);
        }

        this.body.velocity.x = vel.x;
        this.body.velocity.y = vel.y;
        this.body.velocity.z = 0;
    }

    public addShield() {
        if (this.hasShield) return;
        this.hasShield = true;

        const geo = new THREE.RingGeometry(0.7, 0.8, 32);
        const mat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.5 });
        this.shieldMesh = new THREE.Mesh(geo, mat);
        this.mesh.add(this.shieldMesh);
    }

    public takeDamage(): boolean {
        if (this.invulnerabilityTimer > 0) return false;

        if (this.hasShield) {
            this.hasShield = false;
            this.invulnerabilityTimer = 0.5; // 0.5s of invulnerability
            if (this.shieldMesh) {
                this.mesh.remove(this.shieldMesh);
                this.shieldMesh = null;
            }
            return false; // Did not die
        }
        return true; // Died
    }

    public levelUp() {
        if (this.level < 10) { // Increased max level
            this.level++;
            const count = Math.min(6, 1 + Math.floor(this.level / 2));
            const radius = 1.2 + (this.level - 1) * 0.2;
            const speed = 2.0 + (this.level - 1) * 0.3;

            this.orbitSystem.setStats(count, radius, speed, this.mesh.position);

            this.mesh.scale.set(1.5, 1.5, 1);
            setTimeout(() => this.mesh.scale.set(1, 1, 1), 200);
        }
    }

    public reset() {
        this.level = 1;
        this.isDead = false;
        this.hasShield = false;
        if (this.shieldMesh) {
            this.mesh.remove(this.shieldMesh);
            this.shieldMesh = null;
        }
        this.body.position.set(0, 0, 0);
        this.body.velocity.set(0, 0, 0);

        // Re-add mesh and body if they were removed
        if (!this.mesh.parent) {
            this.scene.add(this.mesh);
        }

        // Re-add body to physics world if it was removed
        if (!this.world.bodies.includes(this.body)) {
            this.world.addBody(this.body);
        }


        // Recreate orbit system since it was destroyed
        this.orbitSystem.destroy();
        this.orbitSystem = new OrbitSystem(
            this.scene,
            this.world,
            1,
            1.5,
            2.0,
            this.color,
            this.type,
            this.gameScene,
            new THREE.Vector3(0, 0, 0)
        );

        // Clear trail
        this.trailMeshes.forEach(m => this.scene.remove(m));
        this.trailMeshes = [];
        this.trailPositions = [];
    }

    private updateTrail(deltaTime: number) {
        if (this.isDead) return;

        // Current position
        const currentPos = this.mesh.position.clone();
        const velocity = new CANNON.Vec3(this.body.velocity.x, this.body.velocity.y, 0).length();

        // Always remove old meshes first
        this.trailMeshes.forEach(m => this.scene.remove(m));
        this.trailMeshes = [];

        // Only add to trail if moving
        if (velocity > 0.5) {
            this.trailFadeTimer = 0; // Reset fade timer when moving
            if (this.trailPositions.length === 0 || currentPos.distanceTo(this.trailPositions[0]) > 0.2) {
                this.trailPositions.unshift(currentPos);
                if (this.trailPositions.length > this.MAX_TRAIL) {
                    this.trailPositions.pop();
                }
            }
        } else {
            // Gradually clear trail when stopped - fade out in 0.3 seconds
            this.trailFadeTimer += deltaTime;
            if (this.trailFadeTimer >= 0.3 / this.MAX_TRAIL && this.trailPositions.length > 0) {
                this.trailPositions.pop();
                this.trailFadeTimer = 0;
            }
        }

        // Render current trail
        for (let i = 0; i < this.trailPositions.length; i++) {
            const opacity = 0.5 * (1 - i / this.MAX_TRAIL);
            const scale = 1 - (i / this.MAX_TRAIL) * 0.5;
            const geo = new THREE.CircleGeometry(0.5 * scale, 16);
            const mat = new THREE.MeshBasicMaterial({
                color: this.color,
                transparent: true,
                opacity: opacity
            });
            const m = new THREE.Mesh(geo, mat);
            m.position.copy(this.trailPositions[i]);
            m.position.z = -0.1;
            this.scene.add(m);
            this.trailMeshes.push(m);
        }
    }

    public die() {
        super.die();
        this.trailMeshes.forEach(m => this.scene.remove(m));
        this.trailMeshes = [];
    }
}
