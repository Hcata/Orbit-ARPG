import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { soundManager } from './SoundManager';

export class Projectile {
    public mesh: THREE.Mesh;
    public body: CANNON.Body;
    public isDead: boolean = false;
    private lifeTime: number = 5;

    private static sharedGeometry = new THREE.CapsuleGeometry(0.1, 0.4, 4, 8);
    private static sharedMaterial = new THREE.MeshBasicMaterial({ color: 0xf43f5e });
    private static explosionGeometry = new THREE.CircleGeometry(0.1, 8);
    private static decalGeometry = new THREE.CircleGeometry(0.4, 16);

    constructor(
        private scene: THREE.Scene,
        private world: CANNON.World,
        position: THREE.Vector3,
        direction: THREE.Vector3,
        speed: number,
        private ownerType: 'player' | 'enemy',
        private gameScene: any
    ) {
        this.mesh = new THREE.Mesh(Projectile.sharedGeometry, Projectile.sharedMaterial);

        // Orient towards direction
        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
        this.mesh.quaternion.copy(quaternion);
        this.mesh.position.copy(position);
        this.scene.add(this.mesh);

        const shape = new CANNON.Sphere(0.2);
        this.body = new CANNON.Body({
            mass: 0.1,
            shape: shape,
            position: new CANNON.Vec3(position.x, position.y, position.z),
            velocity: new CANNON.Vec3(direction.x * speed, direction.y * speed, 0),
            collisionFilterGroup: ownerType === 'player' ? 2 : 4,
            collisionFilterMask: ownerType === 'player' ? 8 | 16 : 1 | 16,
        });
        (this.body as any).isWeapon = true;
        (this.body as any).ownerType = ownerType;
        (this.body as any).projectile = this;
        this.world.addBody(this.body);

        // Sound of launch
        this.playSound('launch');
    }

    public update(deltaTime: number) {
        if (this.isDead) return;
        this.lifeTime -= deltaTime;
        if (this.lifeTime <= 0) {
            this.die();
            return;
        }

        this.mesh.position.set(this.body.position.x, this.body.position.y, 0);
    }

    public die(hit: boolean = false) {
        if (this.isDead) return;
        this.isDead = true;

        if (hit) {
            this.createExplosionEffect();
            soundManager.playExplosion();
        }

        this.scene.remove(this.mesh);
        this.gameScene.queueRemoval(this.body);
    }

    private createExplosionEffect() {
        // Delegate explosion particles to GameScene's centralized system
        if (this.gameScene.createExplosionParticles) {
            this.gameScene.createExplosionParticles(this.mesh.position, 0xffa500);
        }

        // Optimized Decal (reusing geometry)
        const decalMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 });
        const decal = new THREE.Mesh(Projectile.decalGeometry, decalMat);
        decal.position.set(this.mesh.position.x, this.mesh.position.y, -0.05);
        this.scene.add(decal);

        // Simple cleanup for decal
        setTimeout(() => {
            this.scene.remove(decal);
            decalMat.dispose();
        }, 5000);
    }

    private playSound(type: 'launch' | 'explosion') {
        // Placeholder for sound implementation
        // In a real project, we'd use AudioBuffer or <audio>
        console.log(`SFX: ${type}`);
    }
}
