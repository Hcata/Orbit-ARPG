import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { BaseCharacter } from './BaseCharacter';

export class Player extends BaseCharacter {
    public level: number = 1;
    public moveSpeed: number = 7;
    private keys: { [key: string]: boolean } = {};

    constructor(scene: THREE.Scene, world: CANNON.World, gameScene: any) {
        // Start at 0,0 for 2D
        super(scene, world, new THREE.Vector3(0, 0, 0), 0x2563eb, 'player', gameScene);

        window.addEventListener('keydown', (e) => this.keys[e.code] = true);
        window.addEventListener('keyup', (e) => this.keys[e.code] = false);
    }

    public update(deltaTime: number) {
        if (this.isDead) return;

        this.handleMovement();
        super.update(deltaTime);
    }

    private handleMovement() {
        const vel = new CANNON.Vec3(0, 0, 0);

        if (this.keys['ArrowUp'] || this.keys['KeyW']) vel.y += 1;
        if (this.keys['ArrowDown'] || this.keys['KeyS']) vel.y -= 1;
        if (this.keys['ArrowLeft'] || this.keys['KeyA']) vel.x -= 1;
        if (this.keys['ArrowRight'] || this.keys['KeyD']) vel.x += 1;

        if (vel.length() > 0) {
            vel.normalize();
            vel.scale(this.moveSpeed, vel);
        }

        this.body.velocity.x = vel.x;
        this.body.velocity.y = vel.y;
        this.body.velocity.z = 0;
    }

    public levelUp() {
        if (this.level < 4) {
            this.level++;
            const count = this.level;
            const radius = 1.2 + (this.level - 1) * 0.6;
            const speed = 2.0 + (this.level - 1) * 0.8;

            this.orbitSystem.setStats(count, radius, speed, this.mesh.position);

            this.mesh.scale.set(1.5, 1.5, 1);
            setTimeout(() => this.mesh.scale.set(1, 1, 1), 200);
        }
    }

    public reset() {
        this.level = 1;
        this.isDead = false;
        this.body.position.set(0, 0, 0);
        this.body.velocity.set(0, 0, 0);
        this.orbitSystem.setStats(1, 1.5, 2.0, new THREE.Vector3(0, 0, 0));
        // Ensure mesh is in scene
        if (!this.mesh.parent) {
            this.scene.add(this.mesh);
        }
    }
}
