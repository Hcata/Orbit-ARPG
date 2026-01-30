import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export enum ItemType {
    SHIELD,
    SPEED,
    EXTRA_ORBIT
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
        let geometry: THREE.BufferGeometry;
        let color: number;

        switch (type) {
            case ItemType.SHIELD:
                geometry = new THREE.TorusGeometry(0.3, 0.05, 16, 32);
                color = 0x06b6d4; // Cyan
                break;
            case ItemType.SPEED:
                geometry = new THREE.SphereGeometry(0.3, 16, 16);
                color = 0x22c55e; // Green
                break;
            case ItemType.EXTRA_ORBIT:
                geometry = new THREE.OctahedronGeometry(0.3, 0);
                color = 0xa855f7; // Purple (changed from yellow)
                break;
            default:
                geometry = new THREE.SphereGeometry(0.3, 16, 16);
                color = 0xffffff;
        }

        const material = new THREE.MeshBasicMaterial({
            color: color,
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
