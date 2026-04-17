import { MatchScene } from "../ui/scenes/MatchScene.ts";
import { GardenScene } from "../ui/scenes/GardenScene.ts";
import { addInventoryToSave, loadSave, unlockLevel, writeSave } from "../save/save.ts";
import type { LevelId } from "../data/levels.ts";
import { getNextLevelId } from "../data/levels.ts";

export function mountApp(root: HTMLElement): void {
  const app = new AppController(root);
  app.mount();
}

type Scene = {
  mount(root: HTMLElement): void;
  unmount(): void;
};

class AppController {
  private current: Scene | null = null;
  private readonly root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  mount(): void {
    this.showGarden();
  }

  private swap(next: Scene): void {
    this.current?.unmount();
    this.current = next;
    next.mount(this.root);
  }

  private showGarden(): void {
    this.swap(
      new GardenScene({
        onGoMatch: (levelId) => this.showMatch(levelId),
      }),
    );
  }

  private showMatch(levelId: LevelId): void {
    this.swap(
      new MatchScene({
        levelId,
        onGoGarden: ({ award, sessionInventory }) => {
          if (award) this.awardAndUnlock(levelId, sessionInventory);
          this.showGarden();
        },
        onGoNextLevel: ({ nextLevelId, sessionInventory }) => {
          this.awardAndUnlock(levelId, sessionInventory);
          this.showMatch(nextLevelId);
        },
      }),
    );
  }

  private awardAndUnlock(levelId: LevelId, sessionInventory: Record<string, number>): void {
    // Only called on victory.
    const next = getNextLevelId(levelId);
    let save = addInventoryToSave(loadSave(), sessionInventory);
    if (next) save = unlockLevel(save, next);
    writeSave(save);
  }
}
