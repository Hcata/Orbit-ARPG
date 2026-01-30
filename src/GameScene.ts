import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Player } from './Player';
import { Enemy, EnemyType } from './Enemy';
import { PhaseManager, GamePhase } from './PhaseManager';
import { Projectile } from './Projectile';
import { Obstacle, ObstacleType } from './Obstacle';
import { Item, ItemType } from './Item';
import { soundManager } from './SoundManager';


export const GameMode = {
    SINGLE: 0,
    PVP: 1
} as const;
export type GameMode = typeof GameMode[keyof typeof GameMode];

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
    private gameMode: GameMode = GameMode.SINGLE;

    private score: number = 0;
    private isGameOver: boolean = true; // Start at main menu

    private lastTime: number = 0;
    private MAP_RADIUS = 15;
    private playerName: string = '';

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
            const targetPlayer = bodyA.character instanceof Player ? bodyA.character : bodyB.character;
            const proj = bodyA.projectile || bodyB.projectile;
            if (proj) proj.die(true);
            this.handlePlayerHit(targetPlayer);
        }

        // Bomb vs Player
        if ((bodyA.isObstacle && bodyA.obstacle.type === ObstacleType.BOMB && bodyB.character instanceof Player) ||
            (bodyB.isObstacle && bodyB.obstacle.type === ObstacleType.BOMB && bodyA.character instanceof Player)) {
            const targetPlayer = bodyA.character instanceof Player ? bodyA.character : bodyB.character;
            const obstacle = bodyA.obstacle || bodyB.obstacle;
            obstacle.die(true);
            this.handlePlayerHit(targetPlayer);
        }

        // Item vs Player
        if ((bodyA.isItem && bodyB.character instanceof Player) || (bodyB.isItem && bodyA.character instanceof Player)) {
            const targetPlayer = bodyA.character instanceof Player ? bodyA.character : bodyB.character;
            const item = bodyA.item || bodyB.item;
            this.collectItem(item, targetPlayer);
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

    private handlePlayerHit(player: Player) {
        if (player.takeDamage()) {
            this.createPlayerDeathEffect(player.mesh.position, player.color);
            soundManager.playDeath();
            player.die();

            // Check if all players are dead
            if (this.player.isDead && this.pvpPlayers.every(p => p.isDead)) {
                setTimeout(() => this.gameOver(), 1500);
            }
        }
    }

    private createPlayerDeathEffect(pos: THREE.Vector3, playerColor: number) {
        // Intense starburst flash using player's color
        const geo = new THREE.CircleGeometry(0.1, 16);
        const mat = new THREE.MeshBasicMaterial({ color: playerColor, transparent: true });
        const flash = new THREE.Mesh(new THREE.CircleGeometry(5, 32), mat);
        flash.position.set(pos.x, pos.y, 1);
        this.scene.add(flash);

        let op = 1.0;
        const animateFlash = () => {
            op -= 0.05;
            if (op <= 0) {
                this.scene.remove(flash);
            } else {
                flash.material.opacity = op;
                flash.scale.multiplyScalar(1.1);
                requestAnimationFrame(animateFlash);
            }
        };
        animateFlash();

        // Particles
        for (let i = 0; i < 50; i++) {
            const p = new THREE.Mesh(geo, mat.clone());
            p.position.copy(pos);
            this.scene.add(p);
            const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, 0).normalize();
            const speed = 5 + Math.random() * 10;
            let life = 1.0;
            const anim = () => {
                if (life <= 0) {
                    this.scene.remove(p);
                } else {
                    p.position.x += dir.x * speed * 0.016;
                    p.position.y += dir.y * speed * 0.016;
                    life -= 0.016;
                    (p.material as THREE.MeshBasicMaterial).opacity = life;
                    requestAnimationFrame(anim);
                }
            };
            anim();
        }
    }

    private collectItem(item: Item, player: Player) {
        this.createItemCollectEffect(item.mesh.position);
        soundManager.playCollect();
        switch (item.type) {
            case ItemType.SHIELD:
                player.addShield();
                break;
            case ItemType.SPEED:
                const originalSpeed = player.moveSpeed;
                player.moveSpeed += 3;
                setTimeout(() => player.moveSpeed = originalSpeed, 10000);
                break;
            case ItemType.EXTRA_ORBIT:
                player.levelUp();
                this.createLevelUpEffect(player.mesh.position);
                soundManager.playFanfare();
                break;
        }
        item.die();
    }

    private createItemCollectEffect(pos: THREE.Vector3) {
        // Gold/Cyan sparks (matching player tones for visibility)
        const colors = [0xffd700, 0x00f2ff];
        for (let i = 0; i < 16; i++) {
            const geo = new THREE.PlaneGeometry(0.1, 0.5);
            const mat = new THREE.MeshBasicMaterial({
                color: colors[i % 2],
                transparent: true,
                opacity: 1.0
            });
            const p = new THREE.Mesh(geo, mat);
            p.position.set(pos.x, pos.y, 1.0); // Higher Z
            p.rotation.z = Math.random() * Math.PI * 2;
            this.scene.add(p);

            const speed = 3 + Math.random() * 3;
            let life = 0.6;
            const anim = () => {
                if (life <= 0) {
                    this.scene.remove(p);
                } else {
                    p.translateY(speed * 0.016);
                    life -= 0.016;
                    mat.opacity = life / 0.6;
                    requestAnimationFrame(anim);
                }
            };
            anim();
        }
    }

    private createLevelUpEffect(pos: THREE.Vector3) {
        // Confetti rain - FULL SCREEN
        const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff, 0xffd700];
        const camX = this.camera.position.x;
        const camY = this.camera.position.y;

        // Spawn 150 larger confetti pieces
        for (let i = 0; i < 150; i++) {
            const size = 0.2 + Math.random() * 0.15; // Larger pieces
            const geo = new THREE.PlaneGeometry(size, size);
            const mat = new THREE.MeshBasicMaterial({
                color: colors[Math.floor(Math.random() * colors.length)],
                side: THREE.DoubleSide,
                transparent: true
            });
            const p = new THREE.Mesh(geo, mat);

            // Random position in a wide area around the camera
            const spawnX = camX + (Math.random() - 0.5) * 30; // Wide horizontal spread
            const spawnY = camY + 15 + Math.random() * 5;     // Start high above camera

            p.position.set(spawnX, spawnY, 2.0); // View priority Z
            this.scene.add(p);

            const speed = 4 + Math.random() * 4;
            const rotSpeed = 5 + Math.random() * 5;
            const drift = (Math.random() - 0.5) * 4;
            let life = 4.0;
            const anim = () => {
                if (life <= 0) {
                    this.scene.remove(p);
                } else {
                    p.position.y -= speed * 0.016;
                    p.position.x += drift * 0.016;
                    p.rotation.x += rotSpeed * 0.016;
                    p.rotation.z += rotSpeed * 0.016;
                    life -= 0.016;
                    if (life < 1.0) mat.opacity = life; // Fade out at the end
                    requestAnimationFrame(anim);
                }
            };
            anim();
        }
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
            soundManager.startMusic(); // Restart music
            this.startGame();
        });

        document.getElementById('btn-start-single')?.addEventListener('click', () => {
            soundManager.startMusic();
        });
        document.getElementById('btn-start-pvp')?.addEventListener('click', () => {
            soundManager.startMusic();
        });

        document.getElementById('btn-instructions')?.addEventListener('click', () => {
            document.getElementById('instructions-overlay')?.classList.add('active');
        });

        document.getElementById('btn-close-instructions')?.addEventListener('click', () => {
            document.getElementById('instructions-overlay')?.classList.remove('active');
        });

        const toggleFullscreen = () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch((err) => {
                    console.error(`Error attempting to enable full-screen mode: ${err.message}`);
                });
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                }
            }
        };

        document.getElementById('btn-fullscreen')?.addEventListener('click', toggleFullscreen);
        document.getElementById('btn-fullscreen-menu')?.addEventListener('click', toggleFullscreen);
    }

    private startGame() {
        this.isGameOver = false;
        this.lastTime = performance.now();
        this.updatePhaseUI();

        console.log("Starting game in mode:", this.gameMode === GameMode.SINGLE ? "SINGLE" : "PVP");

        if (this.gameMode === GameMode.PVP) {
            this.setupPVP();
        } else {
            // In single player, check if a gamepad is available for the main player
            const gamepads = navigator.getGamepads();
            for (let i = 0; i < gamepads.length; i++) {
                if (gamepads[i]) {
                    this.player.setGamepadIndex(i);
                    break;
                }
            }
        }
    }

    private setupPVP() {
        // Clear any existing pvp players
        this.pvpPlayers.forEach(p => p.die());
        this.pvpPlayers = [];

        const gamepads = navigator.getGamepads();
        const gamepadIndices: number[] = [];
        for (let i = 0; i < gamepads.length; i++) {
            if (gamepads[i]) gamepadIndices.push(i);
        }

        console.log("Gamepads detected for PVP:", gamepadIndices);

        const colors = [0x06b6d4, 0x3b82f6, 0xef4444, 0xeab308];

        // Setup Player 1 (Main player)
        this.player.reset();
        this.player.mesh.position.set(-5, 0, 0);
        this.player.body.position.set(-5, 0, 0);

        // If we have gamepads, P1 can use keyboard OR Gamepad 0
        // and P2 uses Gamepad 1, etc.
        // BUT if we only have 1 gamepad, we need it for P2 to have a duel.

        if (gamepadIndices.length === 1) {
            // Only 1 gamepad: P1 = Keyboard, P2 = Gamepad 0
            console.log("1 gamepad: P1=KB, P2=GP0");
            const p2 = new Player(this.scene, this.world, this, 1, gamepadIndices[0], colors[1], new THREE.Vector3(5, 0, 0));
            this.pvpPlayers.push(p2);
        } else {
            // Multiple gamepads: P1 = GP0, P2 = GP1, etc.
            console.log("Multiple gamepads: Mapping sticks to players");
            if (gamepadIndices.length > 0) {
                this.player.setGamepadIndex(gamepadIndices[0]);
            }

            for (let i = 1; i < gamepadIndices.length; i++) {
                if (i >= 4) break;
                const p = new Player(this.scene, this.world, this, i, gamepadIndices[i], colors[i], new THREE.Vector3(5, (i - 1) * 3, 0));
                this.pvpPlayers.push(p);
            }
        }

        console.log("Total PVP players spawned:", 1 + this.pvpPlayers.length);
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
        }
        if (this.phaseManager.currentPhase === GamePhase.PHASE_4_FREE) {
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

        soundManager.playLaser(); // Laser impacting rock sound
        enemy.die();
        this.enemies = this.enemies.filter(e => e !== enemy);

        if (this.phaseManager.onEnemyKilled()) {
            this.updatePhaseUI();
            // Optional: Give reward on phase up
            if (this.phaseManager.currentPhase > GamePhase.PHASE_1_TUTORIAL) {
                this.player.levelUp();
                this.createLevelUpEffect(this.player.mesh.position);
                soundManager.playFanfare();
            }
        }
    }

    private gameOver() {
        if (this.isGameOver) return;
        this.isGameOver = true;
        soundManager.stopMusic(); // Stop music on game over
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
        this.isGameOver = false;
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
        this.pvpPlayers.forEach(p => p.die());
        this.pvpPlayers = [];

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
            this.pvpPlayers.forEach(p => p.update(deltaTime));

            const players = [this.player, ...this.pvpPlayers];

            players.forEach(p => {
                const pPos = p.body.position;
                const dist = Math.sqrt(pPos.x * pPos.x + pPos.y * pPos.y);
                if (dist > this.MAP_RADIUS) {
                    const ratio = this.MAP_RADIUS / dist;
                    p.body.position.x *= ratio;
                    p.body.position.y *= ratio;
                }
            });

            this.enemies.forEach(enemy => {
                // Enemies follow nearest player
                let nearestPlayer = this.player;
                let minDist = enemy.mesh.position.distanceTo(this.player.mesh.position);

                this.pvpPlayers.forEach(p => {
                    const d = enemy.mesh.position.distanceTo(p.mesh.position);
                    if (d < minDist) {
                        minDist = d;
                        nearestPlayer = p;
                    }
                });

                enemy.moveTowards(nearestPlayer.mesh.position);
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

            // Camera follow (center between players or focus on P1)
            if (this.gameMode === GameMode.SINGLE) {
                this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, this.player.mesh.position.x, 0.1);
                this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, this.player.mesh.position.y, 0.1);
            } else {
                // Focus on center of active players
                const activePlayers = players.filter(p => !p.isDead);
                if (activePlayers.length > 0) {
                    const center = new THREE.Vector3();
                    activePlayers.forEach(p => center.add(p.mesh.position));
                    center.divideScalar(activePlayers.length);
                    this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, center.x, 0.1);
                    this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, center.y, 0.1);
                }
            }
        }

        this.renderer.render(this.scene, this.camera);
        requestAnimationFrame((t) => this.animate(t));
    }
}
