/**
 * ConfidenceBadge Component Tests
 * US-CONF-004
 */

import { describe, test, expect } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import { ConfidenceBadge } from "../ConfidenceBadge";

describe("ConfidenceBadge", () => {
	test("renders green badge for high confidence (≥80%)", () => {
		render(<ConfidenceBadge score={0.85} field="email" />);

		const badge = screen.getByRole("status");
		expect(badge).toBeTruthy();
		expect(badge.textContent).toContain("85%");

		// Should have success variant (green)
		expect(badge.className).toContain("bg-green");
	});

	test("renders yellow badge for medium confidence (50-79%)", () => {
		render(<ConfidenceBadge score={0.65} field="phone" />);

		const badge = screen.getByRole("status");
		expect(badge).toBeTruthy();
		expect(badge.textContent).toContain("65%");

		// Should NOT have success or destructive variant
		expect(badge.className).not.toContain("bg-green");
		expect(badge.className).not.toContain("bg-destructive");
	});

	test("renders red badge for low confidence (<50%)", () => {
		render(<ConfidenceBadge score={0.45} field="email" />);

		const badge = screen.getByRole("status");
		expect(badge).toBeTruthy();
		expect(badge.textContent).toContain("45%");

		// Should have destructive variant (red)
		expect(badge.className).toContain("destructive");
	});

	test("displays correct percentage from decimal score", () => {
		render(<ConfidenceBadge score={0.90} field="email" />);

		const badge = screen.getByRole("status");
		expect(badge.textContent).toContain("90%");
	});

	test("rounds percentage correctly", () => {
		// Test rounding down
		render(<ConfidenceBadge score={0.754} field="email" />);
		let badge = screen.getByRole("status");
		expect(badge.textContent).toContain("75%");

		// Test rounding up
		const { unmount } = render(<ConfidenceBadge score={0.755} field="phone" />);
		badge = screen.getByRole("status");
		expect(badge.textContent).toContain("76%");
		unmount();
	});

	test("contains tooltip content with confidence details", () => {
		render(
			<ConfidenceBadge
				score={0.75}
				field="email"
				reasoning="Verified via ZeroBounce"
			/>
		);

		const badge = screen.getByRole("status");
		expect(badge).toBeTruthy();

		// Tooltip content should be in DOM (hidden until hover)
		// Check that reasoning text exists somewhere in the component tree
		const tooltipContainer = document.body;
		expect(tooltipContainer.textContent).toContain("Confidence: 75%");
		expect(tooltipContainer.textContent).toContain("Field: email");
		expect(tooltipContainer.textContent).toContain("Verified via ZeroBounce");
	});

	test("contains tooltip without reasoning when not provided", () => {
		render(<ConfidenceBadge score={0.80} field="phone" />);

		const badge = screen.getByRole("status");
		expect(badge).toBeTruthy();

		// Should show confidence and field in tooltip content
		const tooltipContainer = document.body;
		expect(tooltipContainer.textContent).toContain("Confidence: 80%");
		expect(tooltipContainer.textContent).toContain("Field: phone");

		// Should NOT show generic "Verified" text
		expect(tooltipContainer.textContent).not.toContain("Verified via");
	});

	test("applies custom className", () => {
		render(
			<ConfidenceBadge
				score={0.85}
				field="email"
				className="custom-class"
			/>
		);

		const badge = screen.getByRole("status");
		expect(badge.className).toContain("custom-class");
	});

	test("formats field name correctly (replaces underscores with spaces)", () => {
		render(<ConfidenceBadge score={0.75} field="email_verification" />);

		const badge = screen.getByRole("status");
		expect(badge).toBeTruthy();

		// Should format field name in tooltip content
		const tooltipContainer = document.body;
		expect(tooltipContainer.textContent).toContain("email verification");
	});

	test("has accessible aria-label", () => {
		render(<ConfidenceBadge score={0.85} field="email" />);

		const badge = screen.getByRole("status");
		expect(badge.getAttribute("aria-label")).toBe("email confidence: 85%");
	});

	test("displays correct icons for different confidence levels", () => {
		// High confidence - CheckCircle icon
		const { unmount: unmount1 } = render(
			<ConfidenceBadge score={0.90} field="email" />
		);
		let badge = screen.getByRole("status");
		let icon = badge.querySelector("svg");
		expect(icon).toBeTruthy();
		expect(icon?.getAttribute("aria-hidden")).toBe("true");
		unmount1();

		// Medium confidence - Info icon
		const { unmount: unmount2 } = render(
			<ConfidenceBadge score={0.65} field="email" />
		);
		badge = screen.getByRole("status");
		icon = badge.querySelector("svg");
		expect(icon).toBeTruthy();
		unmount2();

		// Low confidence - AlertTriangle icon
		render(<ConfidenceBadge score={0.40} field="email" />);
		badge = screen.getByRole("status");
		icon = badge.querySelector("svg");
		expect(icon).toBeTruthy();
	});

	test("handles edge case scores correctly", () => {
		// Test boundary conditions
		const testCases = [
			{ score: 0.0, expected: "0%", variant: "destructive" },
			{ score: 0.49, expected: "49%", variant: "destructive" },
			{ score: 0.50, expected: "50%", variant: "default" },
			{ score: 0.79, expected: "79%", variant: "default" },
			{ score: 0.80, expected: "80%", variant: "success" },
			{ score: 1.0, expected: "100%", variant: "success" },
		];

		for (const testCase of testCases) {
			const { unmount } = render(
				<ConfidenceBadge score={testCase.score} field="email" />
			);

			const badge = screen.getByRole("status");
			expect(badge.textContent).toContain(testCase.expected);

			unmount();
		}
	});
});
