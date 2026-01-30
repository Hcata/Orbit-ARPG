export enum PVPState {
    INACTIVE,
    WAITING_FOR_PLAYERS,
    ROUND_START,
    BATTLE,
    ROUND_END,
    MATCH_OVER
}

export interface PlayerStats {
    id: number;
    name: string;
    score: number;
    color: number;
    isReady: boolean;
    device: 'keyboard' | 'gamepad';
    gamepadIndex?: number;
}

export class PVPManager {
    public state: PVPState = PVPState.INACTIVE;
    public players: PlayerStats[] = [];
    public currentRound: number = 0;
    public maxRounds: number = 3;
    public winners: number[] = []; // History of round winners

    constructor() { }

    public initSession(playerCount: number) {
        this.players = [];
        this.currentRound = 1;
        this.winners = [];

        // Settings based on player count
        if (playerCount === 2) this.maxRounds = 3;
        else if (playerCount === 3) this.maxRounds = 4;
        else if (playerCount >= 4) this.maxRounds = 6;
    }

    public addPlayer(id: number, device: 'keyboard' | 'gamepad', index?: number) {
        const colors = [0x22c55e, 0x3b82f6, 0xef4444, 0xeab308];
        this.players.push({
            id,
            name: `Jugador ${id}`,
            score: 0,
            color: colors[id - 1],
            isReady: true,
            device,
            gamepadIndex: index
        });
    }

    public onRoundEnd(winnerId: number) {
        const player = this.players.find(p => p.id === winnerId);
        if (player) {
            player.score++;
            this.winners.push(winnerId);
        }

        if (this.currentRound >= this.maxRounds) {
            this.state = PVPState.MATCH_OVER;
        } else {
            this.state = PVPState.ROUND_END;
        }
    }

    public nextRound() {
        this.currentRound++;
        this.state = PVPState.ROUND_START;
    }

    public getMatchWinner(): PlayerStats | null {
        if (this.players.length === 0) return null;
        return this.players.reduce((prev, current) => (prev.score > current.score) ? prev : current);
    }
}
