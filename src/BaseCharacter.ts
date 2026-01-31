import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { OrbitSystem } from './OrbitSystem';

export abstract class BaseCharacter {
    public mesh: THREE.Mesh;
    public body: CANNON.Body;
    public orbitSystem: OrbitSystem;
    public isDead: boolean = false;

    protected scene: THREE.Scene;
    protected world: CANNON.World;
    public color: number;
    protected type: 'player' | 'enemy';
    protected gameScene: any;

    constructor(
        scene: THREE.Scene,
        world: CANNON.World,
        position: THREE.Vector3,
        color: number,
        type: 'player' | 'enemy',
        gameScene: any
    ) {
        this.scene = scene;
        this.world = world;
        this.color = color;
        this.type = type;
        this.gameScene = gameScene;

        // 2D: Circle geometry
        const geometry = new THREE.CircleGeometry(0.5, 32);
        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 1
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);
        this.scene.add(this.mesh);

        const shape = new CANNON.Sphere(0.5);
        this.body = new CANNON.Body({
            mass: 1,
            shape: shape,
            position: new CANNON.Vec3(position.x, position.y, position.z),
            collisionFilterGroup: type === 'player' ? 1 : 8,
            collisionFilterMask: type === 'player' ? 4 | 8 | 16 | 32 : 1 | 2 | 16,
        });

        (this.body as any).character = this;
        this.world.addBody(this.body);

        this.orbitSystem = new OrbitSystem(
            scene,
            world,
            1,
            1.5,
            2.0,
            color,
            type,
            gameScene,
            position
        );
    }

    public update(deltaTime: number, targetPos?: THREE.Vector3) {
        if (this.isDead) return;

        this.mesh.position.set(this.body.position.x, this.body.position.y, 0);
        this.orbitSystem.update(deltaTime, this.mesh.position);
    }

    public die() {
        this.isDead = true;
        this.scene.remove(this.mesh);
        this.gameScene.queueRemoval(this.body);
        this.orbitSystem.destroy();
    }
}
