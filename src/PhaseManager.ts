export enum GamePhase {
    PHASE_1_TUTORIAL,
    PHASE_2_ESCALATION,
    PHASE_3_OBSTACLES,
    PHASE_4_FREE
}

export class PhaseManager {
    public currentPhase: GamePhase = GamePhase.PHASE_1_TUTORIAL;
    public currentIteration: number = 1;
    public currentSubLevel: number = 1;
    public enemiesToSpawn: number = 0;
    public totalEnemiesInCurrentSubLevel: number = 0;
    public enemiesKilledInSubLevel: number = 0;

    // Phase 1: 4 levels, 3 enemies each
    private phase1Levels = 4;
    private phase1EnemiesPerLevel = 3;

    // Phase 2: 3 rounds (sublevels), 10 enemies each
    private phase2Rounds = 3;
    private phase2EnemiesPerRound = 10;

    // Phase 3: 2 iterations, 10 enemies each
    private phase3Iterations = 2;
    private phase3EnemiesPerIter = 10;

    constructor() {
        this.reset();
    }

    public reset() {
        this.currentPhase = GamePhase.PHASE_1_TUTORIAL;
        this.currentSubLevel = 1;
        this.currentIteration = 1;
        this.enemiesKilledInSubLevel = 0;
        this.setupPhase();
    }

    private setupPhase() {
        switch (this.currentPhase) {
            case GamePhase.PHASE_1_TUTORIAL:
                this.totalEnemiesInCurrentSubLevel = this.phase1EnemiesPerLevel;
                break;
            case GamePhase.PHASE_2_ESCALATION:
                this.totalEnemiesInCurrentSubLevel = this.phase2EnemiesPerRound;
                break;
            case GamePhase.PHASE_3_OBSTACLES:
                this.totalEnemiesInCurrentSubLevel = this.phase3EnemiesPerIter;
                break;
            case GamePhase.PHASE_4_FREE:
                // Handling scaling in nextIteration
                const iterationsInPhase4 = this.currentIteration;
                const scaleFactor = Math.floor((iterationsInPhase4 - 1) / 2);
                this.totalEnemiesInCurrentSubLevel = 10 + scaleFactor;
                break;
        }
        this.enemiesToSpawn = this.totalEnemiesInCurrentSubLevel;
        this.enemiesKilledInSubLevel = 0;
    }

    public onEnemyKilled(): boolean {
        this.enemiesKilledInSubLevel++;
        if (this.enemiesKilledInSubLevel >= this.totalEnemiesInCurrentSubLevel) {
            this.nextSubLevel();
            return true;
        }
        return false;
    }

    private nextSubLevel() {
        this.currentSubLevel++;

        if (this.currentPhase === GamePhase.PHASE_1_TUTORIAL && this.currentSubLevel > this.phase1Levels) {
            this.currentPhase = GamePhase.PHASE_2_ESCALATION;
            this.currentSubLevel = 1;
        } else if (this.currentPhase === GamePhase.PHASE_2_ESCALATION && this.currentSubLevel > this.phase2Rounds) {
            this.currentPhase = GamePhase.PHASE_3_OBSTACLES;
            this.currentSubLevel = 1;
            this.currentIteration = 1;
        } else if (this.currentPhase === GamePhase.PHASE_3_OBSTACLES && this.currentIteration >= this.phase3Iterations) {
            this.currentPhase = GamePhase.PHASE_4_FREE;
            this.currentSubLevel = 1; // Used for Round A/B toggle
            this.currentIteration = 1;
        } else if (this.currentPhase === GamePhase.PHASE_3_OBSTACLES) {
            this.currentIteration++;
        } else if (this.currentPhase === GamePhase.PHASE_4_FREE) {
            this.currentIteration++;
            // Switch between Round A and B
            this.currentSubLevel = (this.currentSubLevel % 2) + 1;
        }

        this.setupPhase();
    }

    public getMaxSimultaneousEnemies(): number {
        if (this.currentPhase === GamePhase.PHASE_1_TUTORIAL) return 5;
        return 15; // Increased for other phases
    }

    public getItemsCount(): number {
        if (this.currentPhase <= GamePhase.PHASE_2_ESCALATION) return 1;
        if (this.currentPhase === GamePhase.PHASE_3_OBSTACLES) return 2;
        return 3;
    }

    public getSpecialEnemyCount(): number {
        if (this.currentPhase !== GamePhase.PHASE_4_FREE) return 0;
        const scaleFactor = Math.floor((this.currentIteration - 1) / 2);
        return 1 + scaleFactor;
    }

    public getPhaseName(): string {
        switch (this.currentPhase) {
            case GamePhase.PHASE_1_TUTORIAL: return `Fase 1: Tutorial (Lvl ${this.currentSubLevel})`;
            case GamePhase.PHASE_2_ESCALATION: return `Fase 2: Escalada (Rnd ${this.currentSubLevel})`;
            case GamePhase.PHASE_3_OBSTACLES: return `Fase 3: Obstáculos (Iter ${this.currentIteration})`;
            case GamePhase.PHASE_4_FREE: return `Fase 4: Modo Libre (Iter ${this.currentIteration}) - ${this.currentSubLevel === 1 ? 'Rnd A' : 'Rnd B'}`;
        }
    }
}
