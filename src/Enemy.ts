import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { BaseCharacter } from './BaseCharacter';
import { Projectile } from './Projectile';

export enum EnemyType {
    RASO,
    LAUNCHER,
    TANK
}

export class Enemy extends BaseCharacter {
    public tier: number = 1;
    public moveSpeed: number = 3;
    public enemyType: EnemyType = EnemyType.RASO;

    private fireCooldown: number = 0;
    private cascadeCount: number = 0;
    private isFiringCascade: boolean = false;
    private lastCascadeFire: number = 0;

    constructor(
        scene: THREE.Scene,
        world: CANNON.World,
        position: THREE.Vector3,
        tier: number,
        gameScene: any,
        type: EnemyType = EnemyType.RASO
    ) {
        // Red color for enemies
        super(scene, world, position, 0xf43f5e, 'enemy', gameScene);
        this.tier = tier;
        this.enemyType = type;
        this.applyTypeStats(position);
    }

    private applyTypeStats(pos: THREE.Vector3) {
        let count = this.tier;
        let radius = 0.8 + (this.tier - 1) * 0.4;
        let speed = 1.5 + (this.tier - 1) * 0.4;

        switch (this.enemyType) {
            case EnemyType.RASO:
                this.moveSpeed = 0.8 + (this.tier * 0.7);
                const s = 0.8 + (this.tier * 0.2);
                this.mesh.scale.set(s, s, 1);
                break;
            case EnemyType.LAUNCHER:
                this.moveSpeed = 2;
                this.mesh.scale.set(1.2, 1.2, 1);
                (this.mesh.material as THREE.MeshBasicMaterial).color.set(0xffa500); // Orange
                break;
            case EnemyType.TANK:
                this.moveSpeed = 1.2;
                this.mesh.scale.set(2, 2, 1);
                (this.mesh.material as THREE.MeshBasicMaterial).color.set(0x991b1b); // Deep red
                // Tank has 4 cores visually (let's add them as children)
                this.addTankCores();
                break;
        }

        this.orbitSystem.setStats(count, radius, speed, pos);
    }

    private addTankCores() {
        const coreGeo = new THREE.CircleGeometry(0.2, 16);
        const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
        for (let i = 0; i < 4; i++) {
            const core = new THREE.Mesh(coreGeo, coreMat.clone());
            const angle = (i * Math.PI) / 2;
            core.position.set(Math.cos(angle) * 0.6, Math.sin(angle) * 0.6, 0.1);
            this.mesh.add(core);
        }
    }

    public update(deltaTime: number) {
        super.update(deltaTime);
        if (this.isDead) return;

        this.handleCombat(deltaTime);
    }

    private handleCombat(deltaTime: number) {
        const playerPos = this.gameScene.getPlayerPosition();
        const dist = playerPos.distanceTo(this.mesh.position);

        if (this.enemyType === EnemyType.TANK) {
            this.fireCooldown -= deltaTime;
            if (this.fireCooldown <= 0 && !this.isFiringCascade) {
                this.isFiringCascade = true;
                this.cascadeCount = 0;
                this.lastCascadeFire = 0;
            }

            if (this.isFiringCascade) {
                this.lastCascadeFire -= deltaTime;
                if (this.lastCascadeFire <= 0) {
                    this.fireMissile(playerPos);
                    this.cascadeCount++;
                    this.lastCascadeFire = 0.3; // Delay between missiles

                    if (this.cascadeCount >= 4) {
                        this.isFiringCascade = false;
                        this.fireCooldown = 3.0; // Wait before next cascade
                    }
                }
            }
        } else if (this.enemyType === EnemyType.LAUNCHER) {
            this.fireCooldown -= deltaTime;
            if (this.fireCooldown <= 0 && dist < 12) {
                this.fireMissile(playerPos);
                this.fireCooldown = 2.0;
            }
        }
    }

    private fireMissile(targetPos: THREE.Vector3) {
        const dir = new THREE.Vector3().subVectors(targetPos, this.mesh.position).normalize();
        this.gameScene.addProjectile(new Projectile(
            this.scene,
            this.world,
            this.mesh.position.clone(),
            dir,
            8,
            'enemy',
            this.gameScene
        ));
    }

    public moveTowards(targetPos: THREE.Vector3) {
        if (this.isDead) return;

        const currentPos = new THREE.Vector3(this.body.position.x, this.body.position.y, 0);
        const direction = new THREE.Vector3().subVectors(targetPos, currentPos);
        const dist = direction.length();

        direction.z = 0;

        // Specialized movement logic
        let actualSpeed = this.moveSpeed;
        if (this.enemyType === EnemyType.LAUNCHER && dist < 8) {
            // Launcher tries to keep distance
            direction.multiplyScalar(-1);
        } else if (this.enemyType === EnemyType.TANK && dist < 4) {
            // Tank stops when close
            actualSpeed = 0;
        }

        if (direction.length() > 0.1 && actualSpeed > 0) {
            direction.normalize();
            this.body.velocity.x = direction.x * actualSpeed;
            this.body.velocity.y = direction.y * actualSpeed;
        } else {
            this.body.velocity.x = 0;
            this.body.velocity.y = 0;
        }
    }
}
