export interface PlayerControls {
    up: string;
    down: string;
    left: string;
    right: string;
}

export enum InputMethod {
    KEYBOARD = 'keyboard',
    GAMEPAD = 'gamepad'
}

export interface PlayerConfig {
    inputMethod: InputMethod;
    controls: PlayerControls;
    gamepadIndex: number | null;
}

export class ControlsManager {
    private static instance: ControlsManager;
    private playerConfigs: Map<number, PlayerConfig> = new Map();

    // Default control schemes
    private static DEFAULT_CONTROLS: PlayerControls[] = [
        { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }, // Player 1
        { up: 'w', down: 's', left: 'a', right: 'd' }, // Player 2
        { up: 'i', down: 'k', left: 'j', right: 'l' }, // Player 3
        { up: 't', down: 'g', left: 'f', right: 'h' }  // Player 4
    ];

    private constructor() {
        this.loadFromStorage();
    }

    public static getInstance(): ControlsManager {
        if (!ControlsManager.instance) {
            ControlsManager.instance = new ControlsManager();
        }
        return ControlsManager.instance;
    }

    public getPlayerConfig(playerIndex: number): PlayerConfig {
        if (!this.playerConfigs.has(playerIndex)) {
            // Create default config
            const defaultControls = ControlsManager.DEFAULT_CONTROLS[playerIndex] ||
                ControlsManager.DEFAULT_CONTROLS[0];
            this.playerConfigs.set(playerIndex, {
                inputMethod: InputMethod.KEYBOARD,
                controls: { ...defaultControls },
                gamepadIndex: null
            });
        }
        return this.playerConfigs.get(playerIndex)!;
    }

    public setPlayerConfig(playerIndex: number, config: PlayerConfig) {
        this.playerConfigs.set(playerIndex, config);
        this.saveToStorage();
    }

    public setPlayerInputMethod(playerIndex: number, method: InputMethod) {
        const config = this.getPlayerConfig(playerIndex);
        config.inputMethod = method;
        this.saveToStorage();
    }

    public setPlayerControls(playerIndex: number, controls: PlayerControls) {
        const config = this.getPlayerConfig(playerIndex);
        config.controls = controls;
        this.saveToStorage();
    }

    public setPlayerGamepad(playerIndex: number, gamepadIndex: number | null) {
        const config = this.getPlayerConfig(playerIndex);
        config.gamepadIndex = gamepadIndex;
        this.saveToStorage();
    }

    public isKeyPressed(playerIndex: number, direction: keyof PlayerControls, pressedKeys: { [key: string]: boolean }): boolean {
        const config = this.getPlayerConfig(playerIndex);
        if (config.inputMethod !== InputMethod.KEYBOARD) return false;

        const key = config.controls[direction];
        return pressedKeys[key] || false;
    }

    private saveToStorage() {
        const data: any = {};
        this.playerConfigs.forEach((config, index) => {
            data[index] = config;
        });
        localStorage.setItem('orbit-arpg-controls', JSON.stringify(data));
    }

    private loadFromStorage() {
        const stored = localStorage.getItem('orbit-arpg-controls');
        if (stored) {
            try {
                const data = JSON.parse(stored);
                Object.keys(data).forEach(key => {
                    const index = parseInt(key);
                    this.playerConfigs.set(index, data[key]);
                });
            } catch (e) {
                console.warn('Failed to load controls from storage');
            }
        }
    }

    public reset() {
        this.playerConfigs.clear();
        localStorage.removeItem('orbit-arpg-controls');
    }
}

export const controlsManager = ControlsManager.getInstance();
