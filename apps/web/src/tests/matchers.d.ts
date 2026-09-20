import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";
import "@vitest/expect";

declare module "@vitest/expect" {
  interface Assertion<T = any> extends TestingLibraryMatchers<any, T> {}
  interface AsymmetricMatchersContaining extends TestingLibraryMatchers<any, any> {}
}
