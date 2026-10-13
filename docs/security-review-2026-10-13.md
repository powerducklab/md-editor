# Security review — 2026-10-13

Scope: Markdown HTML boundaries, video interpolation, fenced mindmap hydration and browser rendering.

P1: video labels/URLs were interpolated into HTML without escaping; mindmap transformer enabled raw HTML independently of the outer renderer. Escape video text/attributes and disable raw HTML in mindmap labels; tests retain safe Markdown formatting.

Validation: package type checks, existing automated tests, targeted regression tests for changes, and release build/package checks. The complete pre-change test/type-check baseline passed for all 17 owned libraries. Final release validation is recorded by the release workflow.

This is a focused P0/P1 review, not a guarantee that all vulnerabilities are absent. npm advisory severity alone is not evidence that a particular application path is exploitable.
