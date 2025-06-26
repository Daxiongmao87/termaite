// TODO: Implement BaseAgent class
// This will be the foundation for all agent types
export class BaseAgent {
  protected name: string;

  constructor(name: string) {
    this.name = name;
  }

  getName(): string {
    return this.name;
  }
}
