import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Projectile {
    public mesh: THREE.Mesh;
    public body: CANNON.Body;
    public isDead: boolean = false;
    private lifeTime: number = 5;

    constructor(
        private scene: THREE.Scene,
        private world: CANNON.World,
        position: THREE.Vector3,
        direction: THREE.Vector3,
        speed: number,
        private ownerType: 'player' | 'enemy',
        private gameScene: any
    ) {
        // Red cyan missile look
        const geometry = new THREE.CapsuleGeometry(0.1, 0.4, 4, 8);
        const material = new THREE.MeshBasicMaterial({ color: 0xf43f5e }); // Crimson
        this.mesh = new THREE.Mesh(geometry, material);

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
            collisionFilterMask: ownerType === 'player' ? 8 : 1,
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
            this.playSound('explosion');
        }

        this.scene.remove(this.mesh);
        this.gameScene.queueRemoval(this.body);
    }

    private createExplosionEffect() {
        // Particle system (simplified for this task)
        const particleCount = 10;
        for (let i = 0; i < particleCount; i++) {
            const geo = new THREE.CircleGeometry(0.1, 8);
            const mat = new THREE.MeshBasicMaterial({ color: 0xffa500, transparent: true });
            const p = new THREE.Mesh(geo, mat);
            p.position.copy(this.mesh.position);
            this.scene.add(p);

            const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, 0).normalize();
            const speed = Math.random() * 2;

            let lifetime = 0.5;
            const animateP = () => {
                if (lifetime <= 0) {
                    this.scene.remove(p);
                    return;
                }
                p.position.x += dir.x * speed * 0.016;
                p.position.y += dir.y * speed * 0.016;
                lifetime -= 0.016;
                mat.opacity = lifetime / 0.5;
                requestAnimationFrame(animateP);
            };
            animateP();
        }

        // Black decal
        const decalGeo = new THREE.CircleGeometry(0.4, 16);
        const decalMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 });
        const decal = new THREE.Mesh(decalGeo, decalMat);
        decal.position.set(this.mesh.position.x, this.mesh.position.y, -0.05);
        this.scene.add(decal);

        // Decal fades out slowly
        setTimeout(() => {
            let op = 0.5;
            const fade = () => {
                op -= 0.01;
                if (op <= 0) {
                    this.scene.remove(decal);
                } else {
                    decalMat.opacity = op;
                    requestAnimationFrame(fade);
                }
            };
            fade();
        }, 5000);
    }

    private playSound(type: 'launch' | 'explosion') {
        // Placeholder for sound implementation
        // In a real project, we'd use AudioBuffer or <audio>
        console.log(`SFX: ${type}`);
    }
}
