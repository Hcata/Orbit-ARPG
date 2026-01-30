import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class OrbitSystem {
    public weapons: { mesh: THREE.Mesh; body: CANNON.Body }[] = [];
    public orbitRing: THREE.Mesh | null = null;
    public angle: number = 0;

    constructor(
        private scene: THREE.Scene,
        private world: CANNON.World,
        private count: number,
        public radius: number,
        public speed: number,
        private color: number,
        private ownerType: 'player' | 'enemy',
        private gameScene: any, // Reference for safe removal
        initialPos: THREE.Vector3
    ) {
        this.createOrbitRing(initialPos);
        this.createWeapons(initialPos);
    }

    private createOrbitRing(pos: THREE.Vector3) {
        if (this.orbitRing) this.scene.remove(this.orbitRing);

        const geometry = new THREE.RingGeometry(this.radius - 0.05, this.radius + 0.05, 64);
        const material = new THREE.MeshBasicMaterial({
            color: this.color,
            transparent: true,
            opacity: 0.4, // Increased from 0.1
            side: THREE.DoubleSide
        });
        this.orbitRing = new THREE.Mesh(geometry, material);
        this.orbitRing.position.set(pos.x, pos.y, -0.1);
        this.scene.add(this.orbitRing);
    }

    public createWeapons(pos: THREE.Vector3) {
        // Only recreate if count truly changed or initial call
        if (this.weapons.length === this.count && this.count > 0) return;

        // Queue old bodies for removal
        this.weapons.forEach(w => {
            this.scene.remove(w.mesh);
            this.gameScene.queueRemoval(w.body);
        });
        this.weapons = [];
        // ...

        const size = 0.3;
        const geometry = new THREE.CircleGeometry(size / 2, 32);
        const material = new THREE.MeshBasicMaterial({
            color: this.color,
            transparent: true,
            opacity: 0.9
        });

        const angleStep = (Math.PI * 2) / (this.count || 1);

        for (let i = 0; i < this.count; i++) {
            const mesh = new THREE.Mesh(geometry, material);

            const currentAngle = this.angle + i * angleStep;
            const x = pos.x + Math.cos(currentAngle) * this.radius;
            const y = pos.y + Math.sin(currentAngle) * this.radius;

            mesh.position.set(x, y, 0);

            const shape = new CANNON.Sphere(size / 2);
            const body = new CANNON.Body({
                mass: 0,
                type: CANNON.Body.KINEMATIC,
                shape: shape,
                position: new CANNON.Vec3(x, y, 0),
                collisionFilterGroup: this.ownerType === 'player' ? 2 : 4,
                collisionFilterMask: this.ownerType === 'player' ? 8 : 1,
            });

            (body as any).ownerType = this.ownerType;
            (body as any).isWeapon = true;

            this.scene.add(mesh);
            this.world.addBody(body);
            this.weapons.push({ mesh, body });
        }
    }

    public update(deltaTime: number, centerPos: THREE.Vector3) {
        this.angle += this.speed * deltaTime;

        const angleStep = (Math.PI * 2) / (this.weapons.length || 1);

        if (this.orbitRing) {
            this.orbitRing.position.set(centerPos.x, centerPos.y, -0.1);
        }

        this.weapons.forEach((w, i) => {
            const currentAngle = this.angle + i * angleStep;

            const x = centerPos.x + Math.cos(currentAngle) * this.radius;
            const y = centerPos.y + Math.sin(currentAngle) * this.radius;

            w.mesh.position.set(x, y, 0);
            w.body.position.set(x, y, 0);
        });
    }

    public setStats(count: number, radius: number, speed: number, currentPos: THREE.Vector3) {
        const radiusChanged = Math.abs(this.radius - radius) > 0.01;
        if (this.count !== count || radiusChanged) {
            this.count = count;
            this.radius = radius;
            this.createOrbitRing(currentPos);
            this.createWeapons(currentPos);
        }
        this.speed = speed;
    }

    public destroy() {
        if (this.orbitRing) this.scene.remove(this.orbitRing);
        this.weapons.forEach(w => {
            this.scene.remove(w.mesh);
            this.gameScene.queueRemoval(w.body);
        });
        this.weapons = [];
    }
}
