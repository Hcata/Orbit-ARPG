import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { BaseCharacter } from './BaseCharacter';

export class Player extends BaseCharacter {
    public level: number = 1;
    public moveSpeed: number = 7;
    public hasShield: boolean = false;
    private keys: { [key: string]: boolean } = {};
    private shieldMesh: THREE.Mesh | null = null;

    constructor(scene: THREE.Scene, world: CANNON.World, gameScene: any) {
        // Cyan color for player
        super(scene, world, new THREE.Vector3(0, 0, 0), 0x06b6d4, 'player', gameScene);

        window.addEventListener('keydown', (e) => this.keys[e.code] = true);
        window.addEventListener('keyup', (e) => this.keys[e.code] = false);
    }

    public update(deltaTime: number) {
        if (this.isDead) return;

        this.handleMovement();
        super.update(deltaTime);

        if (this.shieldMesh) {
            this.shieldMesh.rotation.z += deltaTime * 2;
        }
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

    public addShield() {
        if (this.hasShield) return;
        this.hasShield = true;

        const geo = new THREE.RingGeometry(0.7, 0.8, 32);
        const mat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.5 });
        this.shieldMesh = new THREE.Mesh(geo, mat);
        this.mesh.add(this.shieldMesh);
    }

    public takeDamage(): boolean {
        if (this.hasShield) {
            this.hasShield = false;
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
