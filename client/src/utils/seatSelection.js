export function toggleSeatSelection(selectedSeats, seat, unavailableSeats, limit = 8) {
  if (selectedSeats.includes(seat)) return selectedSeats.filter((item) => item !== seat);
  if (unavailableSeats.includes(seat)) return selectedSeats;
  if (selectedSeats.length >= limit) return selectedSeats;
  return [...selectedSeats, seat];
}

export function keepAvailableSeats(selectedSeats, unavailableSeats) {
  return selectedSeats.filter((seat) => !unavailableSeats.includes(seat));
}

export function getSeatTotal(selectedSeats, pricePerSeat) {
  return selectedSeats.length * (Number(pricePerSeat) || 0);
}

export function seatSelectionStorageKey() {
  return 'imovies-seat-selection';
}

export function seatBookingReturnTo(movieId, search) {
  return `/seats/${encodeURIComponent(movieId)}${search}`;
}

export function seatConfirmationPath(bookingId) {
  return `/confirmation/${encodeURIComponent(bookingId)}`;
}

export async function submitSeatBooking({ showId, seats, token, createBooking }) {
  const response = await createBooking({ showId, seats: [...seats] }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return seatConfirmationPath(response.data.data.booking._id);
}
