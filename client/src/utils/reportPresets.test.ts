import { buildReportDetailHref } from './reportPresets';

describe('buildReportDetailHref', () => {
  it('builds admin contact deep-link when crm contact id exists', () => {
    expect(
      buildReportDetailHref('admin', { crmContactId: 'crm-1', userId: 'u-1', hospitalId: 'h-1' })
    ).toBe('/admin/crm?openContact=crm-1');
  });

  it('builds manager user deep-link when only user id exists', () => {
    expect(buildReportDetailHref('manager', { userId: 'u-1' })).toBe('/manager/team?tab=sites&openUser=u-1');
  });

  it('does not emit unsupported mentor user-only deep-link', () => {
    expect(buildReportDetailHref('mentor', { userId: 'u-1' })).toBeNull();
  });

  it('builds mentor hospital contact deep-link when both ids exist', () => {
    expect(
      buildReportDetailHref('mentor', { hospitalId: 'h-1', hospitalContactId: 'hc-1' })
    ).toBe('/mentor/hospitals?hospital=h-1&contact=hc-1');
  });
});
