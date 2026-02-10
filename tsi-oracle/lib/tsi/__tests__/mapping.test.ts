import { toDisplay, toRaw } from '../mapping';

describe('Display Mapping (mapping.ts)', () => {
  test('22. Midpoint: raw=1850 → display ≈ 505 (midpoint of 10-1000)', () => {
    const display = toDisplay(1850);
    // sigmoid(0) = 0.5 → 10 + 990 * 0.5 = 505
    expect(display).toBeCloseTo(505, 0);
  });

  test('23. Low rating: raw=1500 → display should be low but > 10', () => {
    const display = toDisplay(1500);
    expect(display).toBeGreaterThan(10);
    expect(display).toBeLessThan(200); // Should be quite low
  });

  test('24. High rating: raw=2200 → display should be high but < 1000', () => {
    const display = toDisplay(2200);
    expect(display).toBeLessThan(1000);
    expect(display).toBeGreaterThan(800); // Should be quite high
  });

  test('25. Bounds: display is always in [10, 1000] for any input', () => {
    // Test extreme values
    expect(toDisplay(0)).toBeGreaterThanOrEqual(10);
    expect(toDisplay(0)).toBeLessThanOrEqual(1000);
    expect(toDisplay(5000)).toBeGreaterThanOrEqual(10);
    expect(toDisplay(5000)).toBeLessThanOrEqual(1000);
    expect(toDisplay(-1000)).toBeGreaterThanOrEqual(10);
    expect(toDisplay(-1000)).toBeLessThanOrEqual(1000);

    // Test a range of values
    for (let raw = 800; raw <= 2800; raw += 100) {
      const display = toDisplay(raw);
      expect(display).toBeGreaterThanOrEqual(10);
      expect(display).toBeLessThanOrEqual(1000);
    }
  });

  test('26. Monotonic: higher raw always gives higher display', () => {
    let prevDisplay = toDisplay(1000);
    for (let raw = 1050; raw <= 2500; raw += 50) {
      const display = toDisplay(raw);
      expect(display).toBeGreaterThan(prevDisplay);
      prevDisplay = display;
    }
  });

  test('27. Round trip: toRaw(toDisplay(x)) ≈ x (within 0.1)', () => {
    const testValues = [1200, 1500, 1700, 1850, 2000, 2200, 2400];
    for (const x of testValues) {
      const roundTrip = toRaw(toDisplay(x));
      expect(roundTrip).toBeCloseTo(x, 0); // within 0.1 tolerance
    }
  });
});
