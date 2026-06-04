import { rollupMentorHoursByHospital, sumUnlinkedMentorHours } from './mentorHoursByHospital';

describe('mentorHoursByHospital', () => {
  const hospitals = [{ id: 'h-1', facilityId: '50771', name: 'Coast Plaza' }];

  it('rolls up hours for matching hospitalIds', () => {
    const rollups = rollupMentorHoursByHospital(
      [
        { date: '2026-06-01', hours: 2, hospitalIds: ['50771'] },
        { date: '2026-05-01', hours: 1, hospitalIds: ['h-1'] },
      ],
      hospitals,
      new Date('2026-06-01')
    );
    expect(rollups[0].totalHours).toBe(3);
    expect(rollups[0].hoursThisMonth).toBe(2);
    expect(rollups[0].activityCount).toBe(2);
  });

  it('sums unlinked hours', () => {
    expect(
      sumUnlinkedMentorHours([
        { hours: 1.5, hospitalIds: [] },
        { hours: 2, hospitalIds: ['h-1'] },
      ])
    ).toBe(1.5);
  });
});
