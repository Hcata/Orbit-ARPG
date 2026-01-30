import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export enum ObstacleType {
    BOMB,
    WALL
}

export class Obstacle {
    public mesh: THREE.Mesh;
    public body: CANNON.Body;
    public isDead: boolean = false;
    private lifeTime: number = 10;

    constructor(
        private scene: THREE.Scene,
        private world: CANNON.World,
        position: THREE.Vector3,
        public type: ObstacleType,
        private gameScene: any
    ) {
        const geometry = type === ObstacleType.BOMB
            ? new THREE.IcosahedronGeometry(0.5, 0)
            : new THREE.BoxGeometry(1, 1, 1);

        const material = new THREE.MeshBasicMaterial({
            color: type === ObstacleType.BOMB ? 0xffff00 : 0x475569,
            wireframe: type === ObstacleType.WALL
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);
        this.scene.add(this.mesh);

        const shape = type === ObstacleType.BOMB
            ? new CANNON.Sphere(0.5)
            : new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5));

        this.body = new CANNON.Body({
            mass: type === ObstacleType.BOMB ? 0.1 : 0, // Walls are static
            type: type === ObstacleType.WALL ? CANNON.Body.STATIC : CANNON.Body.DYNAMIC,
            shape: shape,
            position: new CANNON.Vec3(position.x, position.y, position.z),
            collisionFilterGroup: 16,
            collisionFilterMask: 1 | 8 | 2 | 4,
        });

        (this.body as any).isObstacle = true;
        (this.body as any).obstacle = this;
        this.world.addBody(this.body);
    }

    public update(deltaTime: number) {
        if (this.isDead) return;
        this.lifeTime -= deltaTime;
        if (this.lifeTime <= 0) {
            this.die();
            return;
        }

        if (this.type === ObstacleType.BOMB) {
            this.mesh.position.set(this.body.position.x, this.body.position.y, 0);
            // Pulsing effect for bomb
            const s = 1 + Math.sin(Date.now() * 0.01) * 0.1;
            this.mesh.scale.set(s, s, s);
        }
    }

    public die(exploded: boolean = false) {
        if (this.isDead) return;
        this.isDead = true;

        if (exploded && this.type === ObstacleType.BOMB) {
            this.createExplosionEffect();
        }

        this.scene.remove(this.mesh);
        this.gameScene.queueRemoval(this.body);
    }

    private createExplosionEffect() {
        const particleCount = 15;
        for (let i = 0; i < particleCount; i++) {
            const geo = new THREE.CircleGeometry(0.15, 8);
            const mat = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true });
            const p = new THREE.Mesh(geo, mat);
            p.position.copy(this.mesh.position);
            this.scene.add(p);
            const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, 0).normalize();
            const speed = Math.random() * 3;
            let lifetime = 0.6;
            const animateP = () => {
                if (lifetime <= 0) {
                    this.scene.remove(p);
                    return;
                }
                p.position.x += dir.x * speed * 0.016;
                p.position.y += dir.y * speed * 0.016;
                lifetime -= 0.016;
                mat.opacity = lifetime / 0.6;
                requestAnimationFrame(animateP);
            };
            animateP();
        }
    }
}
