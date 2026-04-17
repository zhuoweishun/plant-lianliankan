import { MatchScene } from "../ui/scenes/MatchScene.ts";
import { GardenScene } from "../ui/scenes/GardenScene.ts";
import { addInventoryToSave, loadSave, writeSave } from "../save/save.ts";

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
        onGoMatch: () => this.showMatch(),
      }),
    );
  }

  private showMatch(): void {
    this.swap(
      new MatchScene({
        onGoGarden: (sessionInventory) => {
          const merged = addInventoryToSave(loadSave(), sessionInventory);
          writeSave(merged);
          this.showGarden();
        },
      }),
    );
  }
}
