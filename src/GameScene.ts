import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Player } from './Player';
import { Enemy } from './Enemy';

export class GameScene {
    private scene!: THREE.Scene;
    private camera!: THREE.OrthographicCamera; // Use Orthographic for 2D
    private renderer!: THREE.WebGLRenderer;
    private world!: CANNON.World;

    private player!: Player;
    private enemies: Enemy[] = [];

    private score: number = 0;
    private tier2Kills: number = 0;
    private maxEnemies: number = 5;
    private isGameOver: boolean = false;

    private lastTime: number = 0;
    private MAP_RADIUS = 15;

    constructor() {
        this.initThree();
        this.initPhysics();
        this.createEnvironment();

        this.player = new Player(this.scene, this.world, this);

        this.setupUI();
        this.animate(0);
    }

    private initThree() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf8fafc); // Background claro

        const aspect = window.innerWidth / window.innerHeight;
        const viewSize = 25;
        this.camera = new THREE.OrthographicCamera(
            -viewSize * aspect / 2, viewSize * aspect / 2,
            viewSize / 2, -viewSize / 2,
            0.1, 1000
        );
        this.camera.position.set(0, 0, 10);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        document.getElementById('app')?.appendChild(this.renderer.domElement);

        // Basic ambient light (though BasicMaterials don't need it, good to have)
        const ambientLight = new THREE.AmbientLight(0xffffff, 1);
        this.scene.add(ambientLight);

        window.addEventListener('resize', () => {
            const aspect = window.innerWidth / window.innerHeight;
            this.camera.left = -viewSize * aspect / 2;
            this.camera.right = viewSize * aspect / 2;
            this.camera.top = viewSize / 2;
            this.camera.bottom = -viewSize / 2;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    private bodiesToRemove: CANNON.Body[] = [];

    private initPhysics() {
        // 2D Physics: Use 0 gravity for top-down
        this.world = new CANNON.World({
            gravity: new CANNON.Vec3(0, 0, 0),
            allowSleep: false // Prevents 'wakeUpAfterNarrowphase' errors during high-frequency collisions
        });

        this.world.defaultContactMaterial.friction = 0;
        this.world.defaultContactMaterial.restitution = 0.3; // Slight bounce

        this.world.addEventListener('beginContact', (event: any) => {
            // Defer collision logic slightly or ensure it's safe
            const bodyA = event.bodyA;
            const bodyB = event.bodyB;
            this.handleCollisions(bodyA, bodyB);
        });
    }

    // Method to safely queue a body for removal
    public queueRemoval(body: CANNON.Body) {
        if (!this.bodiesToRemove.includes(body)) {
            this.bodiesToRemove.push(body);
        }
    }

    private handleCollisions(bodyA: any, bodyB: any) {
        if (this.isGameOver) return;

        const isPlayerWeapon = (bodyA.ownerType === 'player' && bodyA.isWeapon) || (bodyB.ownerType === 'player' && bodyB.isWeapon);
        const isEnemyCore = (bodyA.character instanceof Enemy) || (bodyB.character instanceof Enemy);

        if (isPlayerWeapon && isEnemyCore) {
            const enemyBody = bodyA.character instanceof Enemy ? bodyA : bodyB;
            this.killEnemy(enemyBody.character);
        }

        const isEnemyWeapon = (bodyA.ownerType === 'enemy' && bodyA.isWeapon) || (bodyB.ownerType === 'enemy' && bodyB.isWeapon);
        const isPlayerCore = (bodyA.character instanceof Player) || (bodyB.character instanceof Player);

        if (isEnemyWeapon && isPlayerCore) {
            this.gameOver();
        }
    }

    private createEnvironment() {
        // Background Circle for Map
        const floorGeo = new THREE.CircleGeometry(this.MAP_RADIUS, 64);
        const floorMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.position.z = -1; // Behind everything
        this.scene.add(floor);

        // Border
        const borderGeo = new THREE.RingGeometry(this.MAP_RADIUS, this.MAP_RADIUS + 0.2, 64);
        const borderMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0 });
        const border = new THREE.Mesh(borderGeo, borderMat);
        border.position.z = -0.5;
        this.scene.add(border);
    }

    private setupUI() {
        document.getElementById('btn-instructions')?.addEventListener('click', () => {
            document.getElementById('instructions-overlay')?.classList.add('active');
        });

        document.getElementById('btn-close-instructions')?.addEventListener('click', () => {
            document.getElementById('instructions-overlay')?.classList.remove('active');
        });

        document.getElementById('btn-reset')?.addEventListener('click', () => {
            this.resetGame();
        });

        document.getElementById('btn-restart')?.addEventListener('click', () => {
            this.resetGame();
            document.getElementById('gameover-overlay')?.classList.remove('active');
        });
    }

    private spawnEnemy() {
        if (this.enemies.length >= this.maxEnemies || this.isGameOver) return;

        const angle = Math.random() * Math.PI * 2;
        const distance = this.MAP_RADIUS + 3;
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;

        let tier = 1;
        if (this.player.level >= 4) {
            tier = 2;
        }
        if (this.tier2Kills >= 10) {
            tier = 3;
        }

        const enemy = new Enemy(this.scene, this.world, new THREE.Vector3(x, y, 0), tier, this);
        this.enemies.push(enemy);

        if (this.maxEnemies < 10) {
            this.maxEnemies = 5 + Math.min(5, Math.floor(this.score / 5));
        }
    }

    private killsForNextLevel: number = 0;

    private killEnemy(enemy: Enemy) {
        if (enemy.isDead) return;

        this.score++;
        if (enemy.tier === 2) {
            this.tier2Kills++;
        }

        document.getElementById('score')!.innerText = this.score.toString();

        // Level up every 3 kills, but only if not at max level
        if (this.player.level < 4) {
            this.killsForNextLevel++;
            if (this.killsForNextLevel >= 3) {
                this.player.levelUp();
                this.killsForNextLevel = 0;
            }
        }

        enemy.die();
        this.enemies = this.enemies.filter(e => e !== enemy);
    }

    private gameOver() {
        if (this.isGameOver) return;
        this.isGameOver = true;
        document.getElementById('final-score')!.innerText = this.score.toString();
        document.getElementById('gameover-overlay')?.classList.add('active');
    }

    private resetGame() {
        this.score = 0;
        this.tier2Kills = 0;
        this.maxEnemies = 5;
        this.isGameOver = false;
        document.getElementById('score')!.innerText = '0';

        this.enemies.forEach(e => e.die());
        this.enemies = [];
        this.player.reset();
    }

    private animate(time: number) {
        const deltaTime = Math.min((time - this.lastTime) / 1000, 0.1);
        this.lastTime = time;

        // SAFE REMOVAL: Remove bodies outside the physics simulation step
        if (this.bodiesToRemove.length > 0) {
            this.bodiesToRemove.forEach(body => {
                this.world.removeBody(body);
            });
            this.bodiesToRemove = [];
        }

        this.world.step(1 / 60, deltaTime);

        if (!this.isGameOver) {
            this.player.update(deltaTime);

            const pPos = this.player.body.position;
            const dist = Math.sqrt(pPos.x * pPos.x + pPos.y * pPos.y);
            if (dist > this.MAP_RADIUS) {
                const ratio = this.MAP_RADIUS / dist;
                this.player.body.position.x *= ratio;
                this.player.body.position.y *= ratio;
            }

            this.enemies.forEach(enemy => {
                enemy.moveTowards(this.player.mesh.position);
                enemy.update(deltaTime);
            });

            // Camera follow (XY)
            this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, this.player.mesh.position.x, 0.1);
            this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, this.player.mesh.position.y, 0.1);

            if (Math.random() < 0.02) {
                this.spawnEnemy();
            }
        }

        this.renderer.render(this.scene, this.camera);
        requestAnimationFrame((t) => this.animate(t));
    }
}
