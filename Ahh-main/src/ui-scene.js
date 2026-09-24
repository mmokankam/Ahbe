import Phaser from 'phaser';

export default class UIScene extends Phaser.Scene {
  constructor() {
    super('UIScene');
    this.panelWidth = 0;
    this.panelHeight = 184;
    this.buttons = [];
    this.hotbarSlots = [];
    this.attackButtons = [];
  }

  create() {
    this.mainScene = this.scene.get('MainScene');
    this.cameras.main.setScroll(0, 0);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');

    this.panel = this.add.graphics();
    this.healthBar = this.add.graphics();
    this.healthText = this.add.text(0, 0, '', this.pixelTextStyle(16, '#ffffff'));
    this.levelTitle = this.add.text(0, 0, 'Level', this.pixelTextStyle(13, '#ffffff'));
    this.levelValue = this.add.text(0, 0, '1', this.pixelTextStyle(22, '#ffd34f'));
    this.questLabel = this.add.text(0, 0, 'Kill 20 Skeletal bats progress:', {
      ...this.pixelTextStyle(14, '#ffffff'),
      stroke: '#080706',
      strokeThickness: 3
    });
    this.questProgress = this.add.text(0, 0, '15/20', {
      ...this.pixelTextStyle(14, '#ffd34f'),
      stroke: '#080706',
      strokeThickness: 3
    });

    this.createActionButtons();
    this.createHotbar();
    this.createAttackButtons();
    this.createJoystick();
    this.scale.on('resize', this.layout, this);
    this.layout();
    this.updateHealth();
  }

  pixelTextStyle(fontSize, color) {
    return {
      fontFamily: 'monospace',
      fontSize: `${fontSize}px`,
      color,
      fontStyle: 'bold'
    };
  }

  createActionButtons() {
    const actions = [
      ['SET', 0x5d7992, 'Settings'],
      ['MAP', 0x427c73, 'World map'],
      ['CHAT', 0x8b5e78, 'Chat'],
      ['BAG', 0x9b6d3c, 'Inventory']
    ];

    actions.forEach(([label, color, tooltip], index) => {
      const background = this.add.graphics();
      const text = this.add.text(0, 0, label, this.pixelTextStyle(index === 2 ? 9 : 10, '#ffffff'));
      text.setOrigin(0.5);
      const hitArea = this.add.rectangle(0, 0, 52, 52, 0xffffff, 0);
      hitArea.setInteractive({ useHandCursor: true });
      hitArea.on('pointerover', () => this.showTooltip(tooltip));
      hitArea.on('pointerout', () => this.hideTooltip());
      hitArea.on('pointerdown', () => this.flashButton(index));
      this.buttons.push({ background, text, hitArea, color });
    });

    this.tooltip = this.add.text(0, 0, '', this.pixelTextStyle(11, '#f9e2a5'));
    this.tooltip.setOrigin(0.5, 1);
    this.tooltip.setVisible(false);
  }

  createJoystick() {
    const base = this.add.circle(0, 0, 72, 0x332821, 0.5).setStrokeStyle(2, 0xffffff, 0.78);
    const thumb = this.add.circle(0, 0, 26, 0x514944, 0.96).setStrokeStyle(2, 0x1d1714, 0.95);
    this.joystick = this.plugins.get('rexVirtualJoystick').add(this, {
      x: 112,
      y: this.scale.height - 112,
      radius: 72,
      base,
      thumb,
      fixed: true
    });
    this.mainScene.joystick = this.joystick;
  }

  createHotbar() {
    const items = [
      ['PICK', 74, 0x8b6b46],
      ['POT', 844, 0xb93738],
      ['POT', 13, 0xd85d42],
      ['ROD', 4, 0x4e91aa],
      ['FOOD', 28, 0x9b6d3c],
      ['ORE', 6, 0x7d8793]
    ];

    items.forEach(([label, amount, color]) => {
      const background = this.add.graphics();
      const icon = this.add.graphics();
      const amountText = this.add.text(0, 0, String(amount), this.pixelTextStyle(10, '#ffe274'));
      amountText.setOrigin(0, 0);
      this.hotbarSlots.push({ background, icon, amountText, label, color });
    });
  }

  createAttackButtons() {
    const actions = [
      { label: 'HP', color: 0xb63132, tooltip: 'Health potion' },
      { label: 'ATK', color: 0x9d713f, tooltip: 'Attack' }
    ];

    actions.forEach(({ label, color, tooltip }) => {
      const container = this.add.container(0, 0);
      const background = this.add.graphics();
      const icon = this.add.graphics();
      const text = this.add.text(0, 0, label, this.pixelTextStyle(label === 'ATK' ? 11 : 14, '#ffffff'));
      text.setOrigin(0.5);
      const hitArea = this.add.rectangle(0, 0, 76, 76, 0xffffff, 0);
      hitArea.setInteractive({ useHandCursor: true });
      hitArea.on('pointerover', () => this.showTooltip(tooltip));
      hitArea.on('pointerout', () => this.hideTooltip());
      hitArea.on('pointerdown', () => {
        this.tweens.killTweensOf(container);
        this.tweens.add({ targets: container, scale: 0.9, duration: 80, ease: 'Quad.easeOut' });
      });
      hitArea.on('pointerup', () => {
        this.tweens.killTweensOf(container);
        this.tweens.add({ targets: container, scale: 1, duration: 100, ease: 'Back.easeOut' });
      });
      container.add([background, icon, text, hitArea]);
      this.attackButtons.push({ container, background, icon, text, hitArea, color });
    });
  }

  layout() {
    const width = this.scale.width;
    const height = this.scale.height;
    this.panelWidth = Math.min(760, width - 24);
    const panelX = Math.round((width - this.panelWidth) / 2);
    const panelY = Math.max(12, height - this.panelHeight - 18);
    const compact = this.panelWidth < 560;
    const healthX = panelX + 24;
    const healthY = panelY + 23;
    const actionButtonSize = compact ? 38 : 50;
    const healthWidth = compact
      ? Math.max(112, this.panelWidth - 190)
      : Math.min(430, Math.max(210, this.panelWidth * 0.57));
    const levelX = healthX + healthWidth + 44;
    const buttonStartX = levelX + 72;

    this.questLabel.setPosition(20, 20);
    this.questProgress.setPosition(20 + this.questLabel.width + 8, 20);
    this.joystick?.setPosition(112, height - 112);

    this.panel.clear();
    this.panel.fillStyle(0x17100c, 0.97);
    this.panel.fillRoundedRect(panelX, panelY, this.panelWidth, this.panelHeight, 10);
    this.panel.lineStyle(8, 0x4b2b18, 1);
    this.panel.strokeRoundedRect(panelX, panelY, this.panelWidth, this.panelHeight, 10);
    this.panel.lineStyle(3, 0x9a6334, 1);
    this.panel.strokeRoundedRect(panelX + 5, panelY + 5, this.panelWidth - 10, this.panelHeight - 10, 6);
    this.panel.lineStyle(1, 0xd2a05c, 0.7);
    this.panel.lineBetween(panelX + 18, panelY + 12, panelX + this.panelWidth - 18, panelY + 12);
    this.panel.lineBetween(panelX + 18, panelY + this.panelHeight - 12, panelX + this.panelWidth - 18, panelY + this.panelHeight - 12);

    this.healthBar.clear();
    this.healthBar.fillStyle(0x2b1714, 1);
    this.healthBar.fillRoundedRect(healthX, healthY, healthWidth, compact ? 42 : 48, 5);
    this.healthBar.lineStyle(2, 0x6b3d27, 1);
    this.healthBar.strokeRoundedRect(healthX, healthY, healthWidth, compact ? 42 : 48, 5);
    this.drawHealthFill(healthX + 5, healthY + 5, healthWidth - 10, compact ? 32 : 38);
    this.healthText.setPosition(healthX + healthWidth / 2, healthY + (compact ? 21 : 24));
    this.healthText.setFontSize(compact ? 10 : 16);
    this.healthText.setOrigin(0.5);

    this.levelTitle.setPosition(levelX, panelY + 34);
    this.levelTitle.setOrigin(0.5);
    this.levelValue.setPosition(levelX, panelY + 70);
    this.levelValue.setOrigin(0.5);

    this.buttons.forEach((button, index) => {
      const x = compact
        ? panelX + this.panelWidth - 20 - (this.buttons.length - index) * 37
        : buttonStartX + index * 58;
      const y = panelY + 58;
      const size = compact ? 34 : 50;
      button.background.clear();
      button.background.fillStyle(0x090706, 1);
      button.background.fillRoundedRect(x - size / 2, y - size / 2, size, size, 5);
      button.background.lineStyle(2, 0xb27b42, 1);
      button.background.strokeRoundedRect(x - size / 2, y - size / 2, size, size, 5);
      button.background.fillStyle(button.color, 1);
      button.background.fillRoundedRect(x - size / 2 + 6, y - size / 2 + 6, size - 12, size - 12, 3);
      button.text.setPosition(x, y);
      button.text.setFontSize(compact ? 7 : index === 2 ? 9 : 10);
      button.hitArea.setPosition(x, y);
      button.hitArea.setSize(size, size);
    });

    const slotGap = compact ? 3 : 6;
    const slotSize = Math.floor((this.panelWidth - 48 - slotGap * 5) / 6);
    const hotbarY = panelY + 125;
    this.hotbarSlots.forEach((slot, index) => {
      const x = panelX + 24 + index * (slotSize + slotGap);
      const y = hotbarY;
      slot.background.clear();
      slot.background.fillStyle(0x0b0807, 1);
      slot.background.fillRect(x, y, slotSize, slotSize);
      slot.background.lineStyle(2, 0x9a6334, 1);
      slot.background.strokeRect(x, y, slotSize, slotSize);
      slot.background.lineStyle(1, 0xd2a05c, 0.65);
      slot.background.strokeRect(x + 4, y + 4, slotSize - 8, slotSize - 8);
      this.drawHotbarIcon(slot.icon, slot.label, slot.color, x + slotSize / 2, y + slotSize / 2, slotSize);
      slot.amountText.setPosition(x + 6, y + 4);
      slot.amountText.setFontSize(compact ? 8 : 10);
    });

    const attackX = Math.min(width - 54, panelX + this.panelWidth + 52);
    const attackY = height - 145;
    this.attackButtons.forEach((button, index) => {
      const x = attackX;
      const y = attackY + index * 88;
      button.container.setPosition(x, y);
      button.background.clear();
      button.background.fillStyle(0x0b0807, 0.98);
      button.background.fillRect(-40, -40, 80, 80);
      button.background.lineStyle(5, 0x4b2b18, 1);
      button.background.strokeRect(-40, -40, 80, 80);
      button.background.lineStyle(2, 0xb27b42, 1);
      button.background.strokeRect(-33, -33, 66, 66);
      button.background.fillStyle(button.color, 1);
      button.background.fillRect(-27, -27, 54, 54);
      this.drawAttackIcon(button.icon, index);
      button.hitArea.setPosition(0, 0);
      button.hitArea.setSize(76, 76);
    });

    this.tooltip.setPosition(width / 2, panelY - 6);
    this.cameras.main.setViewport(0, 0, width, height);
  }

  drawHotbarIcon(graphics, label, color, x, y, size) {
    graphics.clear();
    graphics.lineStyle(Math.max(2, size / 12), 0xf4e4bd, 1);
    graphics.fillStyle(color, 1);
    if (label === 'PICK') {
      graphics.lineBetween(x - size * 0.18, y + size * 0.25, x + size * 0.18, y - size * 0.25);
      graphics.arc(x, y - size * 0.2, size * 0.2, 200, 340, false);
      return;
    }
    if (label === 'POT') {
      graphics.fillRoundedRect(x - size * 0.16, y - size * 0.05, size * 0.32, size * 0.3, 3);
      graphics.fillRect(x - size * 0.1, y - size * 0.2, size * 0.2, size * 0.12);
      return;
    }
    if (label === 'ROD') {
      graphics.lineBetween(x - size * 0.2, y + size * 0.25, x + size * 0.18, y - size * 0.25);
      graphics.arc(x + size * 0.18, y - size * 0.14, size * 0.16, 0, 180, false);
      return;
    }
    graphics.fillCircle(x, y, size * 0.18);
    graphics.lineBetween(x - size * 0.25, y, x + size * 0.25, y);
  }

  drawAttackIcon(graphics, index) {
    graphics.clear();
    graphics.lineStyle(4, 0xffead0, 1);
    if (index === 0) {
      graphics.fillStyle(0xf06a52, 1);
      graphics.fillRoundedRect(-13, -8, 26, 26, 5);
      graphics.fillRect(-7, -19, 14, 9);
      graphics.lineBetween(-10, -10, 10, -10);
      return;
    }
    graphics.lineBetween(-16, 15, 15, -16);
    graphics.lineBetween(-19, 4, -5, 18);
    graphics.lineBetween(-11, 10, 3, -4);
  }

  drawHealthFill(x, y, width, height) {
    const mainScene = this.mainScene;
    const currentHealth = mainScene?.playerHealth ?? 853;
    const maxHealth = mainScene?.maxPlayerHealth ?? 1135;
    const ratio = Phaser.Math.Clamp(currentHealth / maxHealth, 0, 1);
    this.healthBar.fillStyle(0x721d1c, 1);
    this.healthBar.fillRoundedRect(x, y, width, height, 3);
    this.healthBar.fillStyle(0xc7352d, 1);
    this.healthBar.fillRoundedRect(x, y, width * ratio, height, 3);
    this.healthBar.fillStyle(0xf05b4d, 0.45);
    this.healthBar.fillRoundedRect(x + 2, y + 2, Math.max(0, width * ratio - 4), 7, 2);
  }

  updateHealth() {
    const mainScene = this.mainScene;
    const currentHealth = mainScene?.playerHealth ?? 853;
    const maxHealth = mainScene?.maxPlayerHealth ?? 1135;
    this.healthText.setText(`Health: ${Math.max(0, currentHealth)} / ${maxHealth}`);
    this.levelValue.setText(String(mainScene?.playerLevel ?? 53));
  }

  update() {
    this.updateHealth();
    this.layout();
  }

  showTooltip(text) {
    this.tooltip.setText(text);
    this.tooltip.setVisible(true);
  }

  hideTooltip() {
    this.tooltip.setVisible(false);
  }

  flashButton(index) {
    const button = this.buttons[index];
    if (!button) {
      return;
    }

    this.tweens.add({
      targets: [button.background, button.text],
      alpha: 0.55,
      duration: 90,
      yoyo: true
    });
  }
}