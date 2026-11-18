/**
 * Basic test to verify Jest setup works
 */
describe('Project setup', () => {
  test('Jest is working', () => {
    expect(true).toBe(true);
  });

  test('Environment is Node.js', () => {
    expect(typeof process).toBe('object');
    expect(process.version).toMatch(/^v\d+/);
  });
});
