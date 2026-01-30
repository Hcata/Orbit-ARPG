import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export enum ItemType {
    SHIELD,
    POWERUP // Placeholder for others if needed
}

export class Item {
    public mesh: THREE.Mesh;
    public body: CANNON.Body;
    public isDead: boolean = false;
    private lifeTime: number = 15;

    constructor(
        private scene: THREE.Scene,
        private world: CANNON.World,
        position: THREE.Vector3,
        public type: ItemType,
        private gameScene: any
    ) {
        const geometry = new THREE.TorusGeometry(0.3, 0.05, 16, 32);
        const material = new THREE.MeshBasicMaterial({
            color: type === ItemType.SHIELD ? 0x06b6d4 : 0xffffff,
            transparent: true,
            opacity: 0.9
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);
        this.scene.add(this.mesh);

        const shape = new CANNON.Sphere(0.4);
        this.body = new CANNON.Body({
            mass: 0,
            type: CANNON.Body.KINEMATIC,
            shape: shape,
            position: new CANNON.Vec3(position.x, position.y, position.z),
            collisionFilterGroup: 32,
            collisionFilterMask: 1,
        });

        (this.body as any).isItem = true;
        (this.body as any).item = this;
        this.world.addBody(this.body);
    }

    public update(deltaTime: number) {
        if (this.isDead) return;
        this.lifeTime -= deltaTime;
        if (this.lifeTime <= 0) {
            this.die();
            return;
        }

        this.mesh.rotation.y += deltaTime * 2;
        this.mesh.rotation.x += deltaTime;

        // Floating animation
        this.mesh.position.z = Math.sin(Date.now() * 0.005) * 0.2;
    }

    public die() {
        if (this.isDead) return;
        this.isDead = true;
        this.scene.remove(this.mesh);
        this.gameScene.queueRemoval(this.body);
    }
}
