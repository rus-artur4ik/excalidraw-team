import type {
  Reporter,
  TestModule,
  TestSpecification,
  Vitest,
} from "vitest/node";

export default class ProgressReporter implements Reporter {
  private root = "";
  private total = 0;
  private completed = 0;
  private failed = 0;
  private startedAt = 0;

  onInit(vitest: Vitest) {
    this.root = vitest.config.root;
  }

  onTestRunStart(specifications: readonly TestSpecification[]) {
    this.total = specifications.length;
    this.completed = 0;
    this.failed = 0;
    this.startedAt = Date.now();
    process.stdout.write(`[vitest] running ${this.total} test files\n`);
  }

  onTestModuleEnd(testModule: TestModule) {
    this.completed += 1;
    if (testModule.state() === "failed") {
      this.failed += 1;
    }

    const percent = this.total
      ? Math.round((this.completed / this.total) * 100)
      : 100;
    const elapsed = Math.round((Date.now() - this.startedAt) / 1000);
    const width = String(this.total).length;
    const failures = this.failed ? ` ✗${this.failed}` : "";
    const name = testModule.moduleId.startsWith(this.root)
      ? testModule.moduleId.slice(this.root.length + 1)
      : testModule.moduleId;

    process.stdout.write(
      `[vitest] ${String(this.completed).padStart(width)}/${
        this.total
      } ${String(percent).padStart(3)}%${failures} ${elapsed}s · ${name}\n`,
    );
  }
}
