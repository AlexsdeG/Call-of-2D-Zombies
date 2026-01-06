import Phaser from 'phaser';
import { EventBus } from '../EventBus';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    console.log('MenuScene: Active');
    
    const startGame = () => {
        this.scene.start('MainGameScene');
    };

    // Clean up any stale listeners first
    EventBus.off('start-game');

    // Subscribe
    EventBus.on('start-game', startGame);

    // Cleanup on shutdown
    this.events.on('shutdown', () => {
        EventBus.off('start-game', startGame);
        console.log('MenuScene: Shutdown');
    });
  }
}