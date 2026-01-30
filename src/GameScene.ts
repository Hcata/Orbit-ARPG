import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Player } from './Player';
import { Enemy, EnemyType } from './Enemy';
import { PhaseManager, GamePhase } from './PhaseManager';
import { Projectile } from './Projectile';
import { Obstacle, ObstacleType } from './Obstacle';
import { Item, ItemType } from './Item';
import { PVPManager, PVPState } from './PVPManager';

export enum GameMode {
    SINGLE,
    PVP
}

export class GameScene {
    private scene!: THREE.Scene;
    private camera!: THREE.OrthographicCamera;
    private renderer!: THREE.WebGLRenderer;
    private world!: CANNON.World;

    private player!: Player;
    private pvpPlayers: Player[] = [];
    private enemies: Enemy[] = [];
    private projectiles: Projectile[] = [];
    private obstacles: Obstacle[] = [];
    private items: Item[] = [];

    private phaseManager: PhaseManager = new PhaseManager();
    private pvpManager: PVPManager = new PVPManager();
    private gameMode: GameMode = GameMode.SINGLE;

    private score: number = 0;
    private isGameOver: boolean = true; // Start at main menu

    private lastTime: number = 0;
    private MAP_RADIUS = 15;
    private playerName: string = '';
    private connectedGamepads: Set<number> = new Set();

    private bodiesToRemove: CANNON.Body[] = [];

    constructor() {
        this.initThree();
        this.initPhysics();
        this.createEnvironment();

        this.player = new Player(this.scene, this.world, this);

        this.setupUI();
        this.setupGamepadHandlers();
        this.animate(0);
    }

    private setupGamepadHandlers() {
        window.addEventListener("gamepadconnected", (e) => {
            console.log("Gamepad connected at index %d: %s. %d buttons, %d axes.",
                e.gamepad.index, e.gamepad.id,
                e.gamepad.buttons.length, e.gamepad.axes.length);
            this.updatePlayerSlots();
        });

        window.addEventListener("gamepaddisconnected", (e) => {
            console.log("Gamepad disconnected from index %d", e.gamepad.index);
            this.updatePlayerSlots();
        });
    }

    private updatePlayerSlots() {
        const gamepads = navigator.getGamepads();
        let connectedCount = 0;

        // Slot 1 is always Keyboard/Joy
        const slot1 = document.getElementById('slot-1');
        if (slot1) slot1.classList.remove('disconnected');
        connectedCount++;

        // Update slots 2-4 based on connected gamepads
        const gamepadIndices = [];
        for (let i = 0; i < gamepads.length; i++) {
            if (gamepads[i]) gamepadIndices.push(i);
        }

        for (let i = 2; i <= 4; i++) {
            const slot = document.getElementById(`slot-${i}`);
            const gamepadForSlot = gamepadIndices[i - 2];

            if (gamepadForSlot !== undefined) {
                if (slot) {
                    slot.classList.remove('disconnected');
                    slot.querySelector('.slot-info')!.innerHTML = `Joystick ${gamepadForSlot}`;
                }
                connectedCount++;
            } else {
                if (slot) {
                    slot.classList.add('disconnected');
                    slot.querySelector('.slot-info')!.innerHTML = 'Esperando...';
                }
            }
        }

        const startPvpBtn = document.getElementById('btn-start-pvp') as HTMLButtonElement;
        if (startPvpBtn) {
            startPvpBtn.disabled = connectedCount < 2;
        }
    }

    private initThree() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf1f5f9); // Light slate background

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

    private initPhysics() {
        this.world = new CANNON.World({
            gravity: new CANNON.Vec3(0, 0, 0),
            allowSleep: false
        });

        this.world.defaultContactMaterial.friction = 0;
        this.world.defaultContactMaterial.restitution = 0.3;

        this.world.addEventListener('beginContact', (event: any) => {
            this.handleCollisions(event.bodyA, event.bodyB);
        });
    }

    public queueRemoval(body: CANNON.Body) {
        if (!this.bodiesToRemove.includes(body)) {
            this.bodiesToRemove.push(body);
        }
    }

    private handleCollisions(bodyA: any, bodyB: any) {
        if (this.isGameOver) return;

        // Player weapons vs Enemies
        if ((bodyA.ownerType === 'player' && bodyA.isWeapon && bodyB.character instanceof Enemy) ||
            (bodyB.ownerType === 'player' && bodyB.isWeapon && bodyA.character instanceof Enemy)) {
            const enemy = bodyA.character instanceof Enemy ? bodyA.character : bodyB.character;
            this.killEnemy(enemy);
        }

        // Enemy weapons & Projectiles vs Player
        if ((bodyA.ownerType === 'enemy' && bodyA.isWeapon && bodyB.character instanceof Player) ||
            (bodyB.ownerType === 'enemy' && bodyB.isWeapon && bodyA.character instanceof Player)) {
            const proj = bodyA.projectile || bodyB.projectile;
            if (proj) proj.die(true);
            this.handlePlayerHit();
        }

        // Projectiles vs Projectiles (optional, but good for chaos)

        // Bomb vs Player
        if ((bodyA.isObstacle && bodyA.obstacle.type === ObstacleType.BOMB && bodyB.character instanceof Player) ||
            (bodyB.isObstacle && bodyB.obstacle.type === ObstacleType.BOMB && bodyA.character instanceof Player)) {
            const obstacle = bodyA.obstacle || bodyB.obstacle;
            obstacle.die(true);
            this.handlePlayerHit();
        }

        // Item vs Player
        if ((bodyA.isItem && bodyB.character instanceof Player) || (bodyB.isItem && bodyA.character instanceof Player)) {
            const item = bodyA.item || bodyB.item;
            this.collectItem(item);
        }

        // Projectile vs Obstacle
        if ((bodyA.projectile && bodyB.isObstacle) || (bodyB.projectile && bodyA.isObstacle)) {
            const proj = bodyA.projectile || bodyB.projectile;
            const obstacle = bodyA.obstacle || bodyB.obstacle;
            proj.die(true);
            if (obstacle.type === ObstacleType.BOMB) {
                obstacle.die(true);
            }
        }
    }

    private handlePlayerHit() {
        if (this.player.takeDamage()) {
            this.gameOver();
        }
    }

    private collectItem(item: Item) {
        switch (item.type) {
            case ItemType.SHIELD:
                this.player.addShield();
                break;
            case ItemType.SPEED:
                const originalSpeed = this.player.moveSpeed;
                this.player.moveSpeed += 3;
                setTimeout(() => this.player.moveSpeed = originalSpeed, 10000);
                break;
            case ItemType.EXTRA_ORBIT:
                this.player.levelUp();
                break;
        }
        item.die();
    }

    private createEnvironment() {
        const floorGeo = new THREE.CircleGeometry(this.MAP_RADIUS, 64);
        const floorMat = new THREE.MeshBasicMaterial({ color: 0xffffff }); // Pure white floor
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.position.z = -1;
        this.scene.add(floor);

        const borderGeo = new THREE.RingGeometry(this.MAP_RADIUS, this.MAP_RADIUS + 0.2, 64);
        const borderMat = new THREE.MeshBasicMaterial({ color: 0xcbd5e1, transparent: true, opacity: 0.5 });
        const border = new THREE.Mesh(borderGeo, borderMat);
        border.position.z = -0.5;
        this.scene.add(border);
    }

    private setupUI() {
        // Mode Selection
        document.getElementById('btn-show-single')?.addEventListener('click', () => {
            document.getElementById('mode-selection')?.classList.add('hidden');
            document.getElementById('single-player-setup')?.classList.remove('hidden');
            this.gameMode = GameMode.SINGLE;
        });

        document.getElementById('btn-show-pvp')?.addEventListener('click', () => {
            document.getElementById('mode-selection')?.classList.add('hidden');
            document.getElementById('pvp-setup')?.classList.remove('hidden');
            this.gameMode = GameMode.PVP;
            this.updatePlayerSlots();
        });

        document.getElementById('btn-back-to-modes')?.addEventListener('click', () => {
            document.getElementById('single-player-setup')?.classList.add('hidden');
            document.getElementById('mode-selection')?.classList.remove('hidden');
        });

        document.getElementById('btn-back-to-modes-pvp')?.addEventListener('click', () => {
            document.getElementById('pvp-setup')?.classList.add('hidden');
            document.getElementById('mode-selection')?.classList.remove('hidden');
        });

        // Setup logic
        const nameInput = document.getElementById('player-name') as HTMLInputElement;
        const startSingleBtn = document.getElementById('btn-start-single') as HTMLButtonElement;
        const startPvpBtn = document.getElementById('btn-start-pvp') as HTMLButtonElement;

        nameInput?.addEventListener('input', () => {
            this.playerName = nameInput.value.trim();
            startSingleBtn.disabled = this.playerName.length === 0;
        });

        startSingleBtn?.addEventListener('click', () => {
            document.getElementById('main-menu')?.classList.remove('active');
            this.startGame();
        });

        startPvpBtn?.addEventListener('click', () => {
            document.getElementById('main-menu')?.classList.remove('active');
            this.startGame();
        });

        document.getElementById('btn-reset')?.addEventListener('click', () => {
            this.resetGame();
        });

        document.getElementById('btn-restart')?.addEventListener('click', () => {
            this.resetGame();
            document.getElementById('gameover-overlay')?.classList.remove('active');
            this.startGame();
        });

        document.getElementById('btn-instructions')?.addEventListener('click', () => {
            document.getElementById('instructions-overlay')?.classList.add('active');
        });

        document.getElementById('btn-close-instructions')?.addEventListener('click', () => {
            document.getElementById('instructions-overlay')?.classList.remove('active');
        });
    }

    private startGame() {
        this.isGameOver = false;
        this.lastTime = performance.now();
        this.updatePhaseUI();
    }

    private updatePhaseUI() {
        const phaseNameEl = document.getElementById('phase-name');
        if (phaseNameEl) phaseNameEl.innerText = this.phaseManager.getPhaseName();
    }

    private spawnEnemy() {
        if (this.enemies.length >= this.phaseManager.getMaxSimultaneousEnemies() || this.isGameOver) return;
        if (this.phaseManager.enemiesToSpawn <= 0) return;

        const angle = Math.random() * Math.PI * 2;
        const distance = this.MAP_RADIUS + 2;
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;

        let type = EnemyType.RASO;
        let tier = 1;

        // Logic for specialized enemies
        if (this.phaseManager.currentPhase === GamePhase.PHASE_2_ESCALATION) {
            tier = this.phaseManager.currentSubLevel;
        } else if (this.phaseManager.currentPhase === GamePhase.PHASE_4_FREE) {
            const isSpecialRound = Math.random() < 0.2; // Small chance for extra special enemies
            const specialCount = this.phaseManager.getSpecialEnemyCount();

            // Check current special count
            const currentSpecials = this.enemies.filter(e => e.enemyType !== EnemyType.RASO).length;

            if (currentSpecials < specialCount) {
                type = this.phaseManager.currentSubLevel === 1 ? EnemyType.LAUNCHER : EnemyType.TANK;
            }
        }

        const enemy = new Enemy(this.scene, this.world, new THREE.Vector3(x, y, 0), tier, this, type);
        this.enemies.push(enemy);
        this.phaseManager.enemiesToSpawn--;
    }

    private spawnObstacle() {
        if (this.obstacles.length >= 3 || this.phaseManager.currentPhase < GamePhase.PHASE_3_OBSTACLES) return;

        const x = (Math.random() - 0.5) * this.MAP_RADIUS * 1.5;
        const y = (Math.random() - 0.5) * this.MAP_RADIUS * 1.5;

        // Avoid center and border
        const dist = Math.sqrt(x * x + y * y);
        if (dist < 3 || dist > this.MAP_RADIUS - 1) return;

        const type = Math.random() > 0.5 ? ObstacleType.BOMB : ObstacleType.WALL;
        this.obstacles.push(new Obstacle(this.scene, this.world, new THREE.Vector3(x, y, 0), type, this));
    }

    private spawnItem() {
        const maxItems = this.phaseManager.getItemsCount();
        if (this.items.length >= maxItems) return;

        // Increased spawn rate for better testing/gameplay
        if (Math.random() > 0.02) return;

        const x = (Math.random() - 0.5) * this.MAP_RADIUS;
        const y = (Math.random() - 0.5) * this.MAP_RADIUS;

        const types = [ItemType.SHIELD, ItemType.SPEED, ItemType.EXTRA_ORBIT];
        const randomType = types[Math.floor(Math.random() * types.length)];

        this.items.push(new Item(this.scene, this.world, new THREE.Vector3(x, y, 0), randomType, this));
    }

    public addProjectile(p: Projectile) {
        this.projectiles.push(p);
    }

    public getPlayerPosition(): THREE.Vector3 {
        return this.player.mesh.position;
    }

    private killEnemy(enemy: Enemy) {
        if (enemy.isDead) return;
        this.score++;
        document.getElementById('score')!.innerText = this.score.toString();

        if (this.phaseManager.currentPhase === GamePhase.PHASE_1_TUTORIAL) {
            this.player.levelUp();
        }

        enemy.die();
        this.enemies = this.enemies.filter(e => e !== enemy);

        if (this.phaseManager.onEnemyKilled()) {
            this.updatePhaseUI();
            // Optional: Give reward on phase up
            if (this.phaseManager.currentPhase > GamePhase.PHASE_1_TUTORIAL) {
                this.player.levelUp();
            }
        }
    }

    private gameOver() {
        if (this.isGameOver) return;
        this.isGameOver = true;
        document.getElementById('final-score')!.innerText = this.score.toString();
        this.showLeaderboard();
        document.getElementById('gameover-overlay')?.classList.add('active');
    }

    private showLeaderboard() {
        const list = document.getElementById('leaderboard-list');
        if (!list) return;

        // Simulated leaderboard data
        const players = [
            { name: "Alpha", score: 500 },
            { name: "Bravo", score: 450 },
            { name: "Charlie", score: 300 },
            { name: this.playerName, score: this.score, current: true }
        ].sort((a, b) => b.score - a.score);

        list.innerHTML = players.map(p => `
            <div class="leaderboard-item ${p.current ? 'current-player' : ''}">
                <span>${p.name}</span>
                <span>${p.score}</span>
            </div>
        `).join('');
    }

    private resetGame() {
        this.score = 0;
        this.isGameOver = true;
        document.getElementById('score')!.innerText = '0';

        this.enemies.forEach(e => e.die());
        this.enemies = [];
        this.projectiles.forEach(p => p.die());
        this.projectiles = [];
        this.obstacles.forEach(o => o.die());
        this.obstacles = [];
        this.items.forEach(i => i.die());
        this.items = [];

        this.player.reset();
        this.phaseManager.reset();
        this.updatePhaseUI();
    }

    private animate(time: number) {
        const deltaTime = Math.min((time - this.lastTime) / 1000, 0.1);
        this.lastTime = time;

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

            this.projectiles = this.projectiles.filter(p => !p.isDead);
            this.projectiles.forEach(p => p.update(deltaTime));

            this.obstacles = this.obstacles.filter(o => !o.isDead);
            this.obstacles.forEach(o => o.update(deltaTime));

            this.items = this.items.filter(i => !i.isDead);
            this.items.forEach(i => i.update(deltaTime));

            // Spawning
            if (Math.random() < 0.05) this.spawnEnemy();
            if (Math.random() < 0.01) this.spawnObstacle();
            if (Math.random() < 0.01) this.spawnItem();

            // Camera follow
            this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, this.player.mesh.position.x, 0.1);
            this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, this.player.mesh.position.y, 0.1);
        }

        this.renderer.render(this.scene, this.camera);
        requestAnimationFrame((t) => this.animate(t));
    }
}
