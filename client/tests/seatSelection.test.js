import test from 'node:test';
import assert from 'node:assert/strict';
import { getSeatTotal, keepAvailableSeats, seatBookingReturnTo, seatSelectionStorageKey, submitSeatBooking, toggleSeatSelection } from '../src/utils/seatSelection.js';

test('selects and deselects seats without duplicates', () => {
  const once = toggleSeatSelection([], 'A1', []);
  assert.deepEqual(once, ['A1']);
  assert.deepEqual(toggleSeatSelection(once, 'A1', []), []);
  assert.deepEqual(toggleSeatSelection([], 'A1', []), ['A1']);
});

test('booked seats cannot be added and unavailable selections are pruned', () => {
  assert.deepEqual(toggleSeatSelection([], 'A2', ['A2']), []);
  assert.deepEqual(keepAvailableSeats(['A1', 'A2'], ['A2']), ['A1']);
});

test('seat totals reflect selection count and current ticket price', () => {
  assert.equal(getSeatTotal(['A1', 'A2', 'B4'], 250), 750);
  assert.equal(getSeatTotal([], 250), 0);
});

test('seat selection can be restored after login and routes back to the selected show', () => {
  const search = '?showId=show-123&show=7%3A30%20PM';
  assert.equal(seatSelectionStorageKey(), 'imovies-seat-selection');
  assert.equal(seatBookingReturnTo('the-last-orbit', search), '/seats/the-last-orbit?showId=show-123&show=7%3A30%20PM');
});

test('continuing submits the selected show and seats, then opens its confirmation route', async () => {
  let request;
  const path = await submitSeatBooking({
    showId: 'show-123',
    seats: ['A1', 'A2'],
    token: 'valid-token',
    createBooking: async (payload, config) => {
      request = { payload, config };
      return { data: { data: { booking: { _id: 'booking-456' } } } };
    },
  });
  assert.deepEqual(request.payload, { showId: 'show-123', seats: ['A1', 'A2'] });
  assert.equal(request.config.headers.Authorization, 'Bearer valid-token');
  assert.equal(path, '/confirmation/booking-456');
});
