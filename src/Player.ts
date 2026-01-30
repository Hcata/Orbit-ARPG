import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { BaseCharacter } from './BaseCharacter';

export class Player extends BaseCharacter {
    public level: number = 1;
    public moveSpeed: number = 7;
    public hasShield: boolean = false;
    private keys: { [key: string]: boolean } = {};
    private shieldMesh: THREE.Mesh | null = null;
    private invulnerabilityTimer: number = 0;
    private playerIndex: number;
    private gamepadIndex: number | null;

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
        this.orbitSystem.setStats(1, 1.5, 2.0, new THREE.Vector3(0, 0, 0));
        if (!this.mesh.parent) {
            this.scene.add(this.mesh);
        }
    }
}
