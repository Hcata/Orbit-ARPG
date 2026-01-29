import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { BaseCharacter } from './BaseCharacter';

export class Enemy extends BaseCharacter {
    public tier: number = 1;
    public moveSpeed: number = 3;

    constructor(
        scene: THREE.Scene,
        world: CANNON.World,
        position: THREE.Vector3,
        tier: number,
        gameScene: any
    ) {
        super(scene, world, position, 0xef4444, 'enemy', gameScene);
        this.tier = tier;
        this.applyTierStats(position);
    }

    private applyTierStats(pos: THREE.Vector3) {
        const count = this.tier;
        const radius = 0.8 + (this.tier - 1) * 0.4;
        const speed = 1.5 + (this.tier - 1) * 0.4;

        this.orbitSystem.setStats(count, radius, speed, pos);

        // REDUCED SPEED: Base speed is lower now
        // Tier 1: 1.5, Tier 2: 2.2, Tier 3: 2.9
        this.moveSpeed = 0.8 + (this.tier * 0.7);

        const s = 0.8 + (this.tier * 0.2);
        this.mesh.scale.set(s, s, 1);
    }

    public moveTowards(targetPos: THREE.Vector3) {
        if (this.isDead) return;

        const currentPos = new THREE.Vector3(this.body.position.x, this.body.position.y, 0);
        const direction = new THREE.Vector3().subVectors(targetPos, currentPos);

        direction.z = 0;

        if (direction.length() > 0.1) {
            direction.normalize();
            this.body.velocity.x = direction.x * this.moveSpeed;
            this.body.velocity.y = direction.y * this.moveSpeed;
        } else {
            this.body.velocity.x = 0;
            this.body.velocity.y = 0;
        }
    }
}
