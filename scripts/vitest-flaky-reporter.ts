import type { Reporter, TestCase } from "vitest/node";

export default class FlakyReporter implements Reporter {
  private flaky: string[] = [];

  onTestCaseResult(testCase: TestCase) {
    const result = testCase.result();
    if (result.state === "passed" && result.errors?.length) {
      this.flaky.push(testCase.fullName);
    }
  }

  onTestRunEnd() {
    if (!this.flaky.length) {
      return;
    }
    process.stdout.write(
      `\n[vitest] ${this.flaky.length} flaky test(s) passed only after retry:\n`,
    );
    for (const name of this.flaky) {
      process.stdout.write(`[vitest]   ⚠ ${name}\n`);
    }
  }
}
