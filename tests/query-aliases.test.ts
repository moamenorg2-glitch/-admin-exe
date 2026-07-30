import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..');

function read(file: string) {
  return readFileSync(path.join(root, file), 'utf8');
}

describe('Supabase query aliases', () => {
  it('uses the correct joined-table alias for master order date filters', () => {
    const driverService = read('src/services/driverService.ts');
    const userService = read('src/services/userService.ts');

    expect(driverService).toContain(".gte('master_order.created_at'");
    expect(userService).toContain(".gte('master_order.created_at'");
  });

  it('uses the correct alias for profile status filtering in driver queries', () => {
    const driverService = read('src/services/driverService.ts');

    expect(driverService).not.toContain(".neq('profiles.status'");
    expect(driverService).toContain(".neq('profile.status'");
  });
});
