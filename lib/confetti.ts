/**
 * Confetti when an application becomes Accepted (front-end spec §16): two bursts from the
 * bottom corners, 80 particles each, brand colors, about 1.2 s.
 */
import confettiLib from "canvas-confetti";

const COLORS = ["#F58529", "#DD2A7B", "#8134AF", "#FFFFFF"];

export function confetti() {
  if (typeof window === "undefined") return;
  const shared = { particleCount: 80, spread: 60, startVelocity: 55, ticks: 90, gravity: 1.1, colors: COLORS, zIndex: 100 };
  void confettiLib({ ...shared, angle: 60, origin: { x: 0, y: 1 } });
  void confettiLib({ ...shared, angle: 120, origin: { x: 1, y: 1 } });
}
