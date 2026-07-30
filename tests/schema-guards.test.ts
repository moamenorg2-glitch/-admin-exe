import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..');

function read(file: string) {
  return readFileSync(path.join(root, file), 'utf8');
}

describe('schema guardrails', () => {
  it('keeps the supported joined-table filter pattern in reports', () => {
    const reports = read('src/pages/reports/ReportsDashboard.tsx');
    const financeTx = read('src/pages/finance/TransactionsList.tsx');

    expect(reports).toContain(".eq('master_order.status', 'Completed')");
    expect(financeTx).toContain(".from('wallets_transaction')");
  });
});
