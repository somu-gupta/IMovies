import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, CalendarDays, ChevronDown, Clapperboard, Clock3, Film, MapPin, ShieldCheck, Sparkles, Star, Ticket } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/useAuth.js';
import { API_URL } from '../services/api.js';
import { sampleMovies, genres, seatRowName } from '../data/movies.js';
import { MovieCard } from '../components/SiteChrome.jsx';
import { getSeatTotal, keepAvailableSeats, seatBookingReturnTo, seatSelectionStorageKey, submitSeatBooking, toggleSeatSelection } from '../utils/seatSelection.js';
export function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams(); const query = searchParams.get('q') || ''; const [movies, setMovies] = useState(sampleMovies); const [genre, setGenre] = useState('All films'); const [language, setLanguage] = useState('All languages'); const [loading, setLoading] = useState(true); const [catalogueError, setCatalogueError] = useState('');
  useEffect(() => { let active = true; axios.get(`${API_URL}/movies`).then(({ data }) => { const rows = data.data?.movies || data.data || data.movies; if (active && Array.isArray(rows)) setMovies(rows.map((movie) => ({ ...movie, id: movie.slug || movie._id, color: movie.color || 'orbit' }))); }).catch(() => { if (active) setCatalogueError('The live catalogue is unavailable; sample titles are shown.'); }).finally(() => active && setLoading(false)); return () => { active = false; }; }, []);
  const filtered = useMemo(() => movies.filter((movie) => (genre === 'All films' || movie.genre === genre || movie.genres?.includes(genre)) && (language === 'All languages' || movie.language === language) && movie.title.toLowerCase().includes(query.toLowerCase())), [movies, genre, language, query]);
  return <><main><section className="hero"><div className="hero-backdrop"/><div className="hero-inner"><div className="hero-copy"><span className="hero-kicker"><Sparkles size={14}/> THE IMOVIES PREMIERE</span><h1>Some stories<br/>stay with <em>you.</em></h1><p>Find your next favourite. From the first frame to the final credits, make it a night worth remembering.</p><a href="#now-showing" className="hero-cta">Explore movies <ArrowRight size={16}/></a><div className="hero-index"><span>01</span><div/><span>FEATURED THIS WEEK</span></div></div><div className="featured-poster"><img src={sampleMovies[0].poster} alt="The Last Orbit, featured movie"/><div className="featured-overlay"/><div className="featured-label"><span>FEATURED THIS WEEK</span><strong>THE LAST<br/>ORBIT</strong><small>ONLY IN CINEMAS</small></div><div className="featured-rating"><Star size={13} fill="currentColor"/> 8.7</div></div><div className="hero-side-note">THE STORIES WE SHARE <span>·</span> 2026</div></div></section><section className="catalogue section-shell" id="trending"><div className="section-heading"><div><span className="section-overline">THE CROWD FAVOURITES</span><h2>Trending movies<span className="title-period">.</span></h2></div></div><div className="movie-grid">{[...filtered].sort((a,b) => Number(b.rating || 0) - Number(a.rating || 0)).slice(0,4).map((movie,index) => <MovieCard key={movie.id || movie._id} movie={movie} index={index}/>)}</div></section><section className="catalogue section-shell" id="now-showing"><div className="section-heading"><div><span className="section-overline">PICK YOUR PICTURE</span><h2>Now showing<span className="title-period">.</span></h2></div><a className="view-all" href="#all-movies">VIEW ALL <ArrowRight size={14}/></a></div><div className="filter-row"><div className="genre-list" aria-label="Filter by genre">{genres.map((item) => <button key={item} className={`genre-pill ${genre === item ? 'selected' : ''}`} onClick={() => setGenre(item)}>{item}</button>)}</div><label className="language-filter"><span className="visually-hidden">Filter by language</span><select value={language} onChange={(event) => setLanguage(event.target.value)}><option>All languages</option>{['English', 'Hindi', 'Tamil', 'Telugu', 'Malayalam'].map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={14}/></label></div>{loading && <div className="loading-line"><span/> Updating the latest listings</div>}{catalogueError && <p className="form-error" role="status">{catalogueError}</p>}<div className="movie-grid" id="all-movies">{filtered.map((movie, index) => <MovieCard key={movie.id || movie._id} movie={movie} index={index}/>)}</div>{!filtered.length && <div className="empty-state"><Film size={30}/><h3>No films found</h3><p>Try a different title, genre or language.</p><button className="text-button" onClick={() => { setGenre('All films'); setLanguage('All languages'); setSearchParams({}); }}>Clear filters</button></div>}</section><section className="catalogue section-shell" id="upcoming"><div className="section-heading"><div><span className="section-overline">COMING SOON</span><h2>Upcoming movies<span className="title-period">.</span></h2></div></div><div className="movie-grid">{sampleMovies.slice(4,8).map((movie,index) => <MovieCard key={movie.id} movie={movie} index={index}/>)}</div></section><section className="cinema-banner" id="cinemas"><div id="offers"><span className="section-overline">A BETTER WAY TO GO OUT</span><h2>Your seat is waiting.</h2><p>Pick your film, find a time, and we’ll save you the good seats.</p></div><a href="#now-showing" className="hero-cta">Find a cinema <MapPin size={16}/></a><div className="banner-orbit"/></section></main></>;
}

export function NotFoundPage() {
  return <main className="empty-state section-shell"><span className="section-overline">WRONG TURN</span><h1>That page isn’t in this reel.</h1><p>The address may be outdated or the page may have moved.</p><Link className="hero-cta" to="/movies">Browse movies <ArrowRight size={16}/></Link></main>;
}

export function MoviesPage() {
  const [movies, setMovies] = useState(sampleMovies);
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [genre, setGenre] = useState('All films');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    axios.get(`${API_URL}/movies`).then(({ data }) => {
      const rows = data.data?.movies || data.data || data.movies;
      if (active && Array.isArray(rows)) {
        setMovies(rows.map((movie) => ({ ...movie, id: movie.slug || movie._id })));
        setLoadError('');
      }
    }).catch(() => {
      if (active) setLoadError('The live catalogue could not be reached. Showing the sample movie list.');
    }).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [retry]);
  const filtered = movies.filter((movie) => movie.title.toLowerCase().includes(query.toLowerCase()) && (genre === 'All films' || movie.genre === genre || movie.genres?.includes(genre)));
  return <main className="catalogue section-shell movies-page"><span className="section-overline">THE FULL COLLECTION</span><h1>Find your next film<span className="title-period">.</span></h1><div className="filter-row"><input className="movie-search" aria-label="Search movies" placeholder="Search by title" value={query} onChange={(event) => setSearchParams({ q: event.target.value }, { replace: true })} /><label className="language-filter"><span className="visually-hidden">Filter by genre</span><select value={genre} onChange={(event) => setGenre(event.target.value)}>{genres.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={14}/></label></div>{loading && <p className="loading-line">Loading the latest movies…</p>}{loadError && <p className="form-error" role="status">{loadError} <button className="text-button" onClick={() => { setLoading(true); setRetry((value) => value + 1); }}>Retry</button></p>}<div className="movie-grid">{filtered.map((movie, index) => <MovieCard key={movie.id || movie._id} movie={movie} index={index}/>)}</div>{!filtered.length && <div className="empty-state"><Film size={30}/><h3>No films found</h3><p>Try another title or genre.</p></div>}</main>;
}

export function MoviePage() {
  const { id } = useParams();
  const [movie, setMovie] = useState(() => sampleMovies.find((item) => item.id === id) || null);
  const [shows, setShows] = useState([]); const [selectedShow, setSelectedShow] = useState(null); const [error, setError] = useState('');
  const dateKey = (day) => `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  const days = Array.from({ length: 5 }, (_, i) => { const day = new Date(); day.setDate(day.getDate() + i); return { key: dateKey(day), label: i === 0 ? 'TODAY' : day.toLocaleDateString('en', { weekday: 'short' }).toUpperCase(), date: day.getDate(), month: day.toLocaleDateString('en', { month: 'short' }) }; });
  const [selectedDate, setSelectedDate] = useState(days[0].key);
  useEffect(() => { let active = true; axios.get(`${API_URL}/movies/${id}`).then(({ data }) => { if (!active) return; const found = data.data?.movie; if (found) { setMovie({ ...found, id: found.slug || found._id, poster: found.posterUrl }); setError(''); } else setError('This movie could not be found.'); setShows(data.data?.shows || []); }).catch((requestError) => { if (active) setError(requestError.response?.status === 404 ? 'This movie could not be found.' : 'Showtimes are unavailable. Start the API and seed the local database to browse live sessions.'); }); return () => { active = false; }; }, [id]);
  const dailyShows = shows.filter((item) => dateKey(new Date(item.startsAt)) === selectedDate);
  const displayDate = days.find((day) => day.key === selectedDate) || days[0];
  if (!movie) return <main className="detail-page section-shell"><Link to="/movies" className="back-link">Back to movies</Link><div className="empty-state"><Film size={30}/><h1>{error ? 'Movie unavailable.' : 'Loading movie…'}</h1><p>{error || 'Loading movie details and showtimes.'}</p></div></main>;
  return <><main className="detail-page"><Link to="/" className="back-link">← Back to movies</Link><section className="detail-hero"><img src={movie.poster || movie.posterUrl} alt=""/><div className="detail-shade"/><div className="detail-content"><span className="hero-kicker"><Clapperboard size={14}/> NOW SHOWING</span><h1>{movie.title}</h1><div className="detail-facts"><span><Star size={14} fill="currentColor"/> {movie.rating}</span><span>{movie.certificate}</span><span>{movie.duration} min</span><span>{movie.language}</span></div><p>{movie.description}</p></div></section><div className="detail-grid"><section><div className="section-heading"><div><span className="section-overline">MAKE IT A MOVIE NIGHT</span><h2>Choose a show<span className="title-period">.</span></h2></div></div><div className="date-row">{days.map((day) => <button key={day.key} onClick={() => { setSelectedDate(day.key); setSelectedShow(null); }} className={`date-tile ${selectedDate === day.key ? 'active' : ''}`}><span>{day.label}</span><strong>{day.date}</strong></button>)}</div>{dailyShows.length > 0 ? <div className="show-grid">{dailyShows.map((item) => <button key={item._id} onClick={() => setSelectedShow(item)} className={selectedShow?._id === item._id ? 'selected' : ''}>{new Date(item.startsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}<span>{item.cinema?.name || 'Cinema'} · ₹{item.ticketPrice}</span></button>)}</div> : <div className="show-empty">{error || 'No sessions listed for this date yet.'}</div>}</section><aside className="booking-summary"><span className="section-overline">YOUR SELECTION</span><h3>{movie.title}</h3><p><CalendarDays size={15}/> {displayDate.label}, {displayDate.date} {displayDate.month}</p><p><MapPin size={15}/> {selectedShow?.cinema?.name || 'Choose a cinema'}</p><p><Clock3 size={15}/> {selectedShow ? new Date(selectedShow.startsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Choose a showtime'}</p><div className="summary-rule"/><div className="price-line"><span>Price per ticket</span><strong>{selectedShow ? `₹${selectedShow.ticketPrice}` : '—'}</strong></div><Link className={`hero-cta full-width ${!selectedShow ? 'disabled-link' : ''}`} aria-disabled={!selectedShow} to={selectedShow ? `/seats/${movie.id}?showId=${selectedShow._id}&show=${encodeURIComponent(new Date(selectedShow.startsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))}` : '#'}>Choose seats <ArrowRight size={16}/></Link><small><ShieldCheck size={13}/> Availability is confirmed when you book.</small></aside></div></main></>;
}

export function AuthPage({ register = false }) {
  const [message, setMessage] = useState(''); const navigate = useNavigate(); const location = useLocation(); const { signIn } = useAuth();
  async function submit(event) { event.preventDefault(); setMessage(''); const fields = Object.fromEntries(new FormData(event.currentTarget)); if (register && fields.password !== fields.confirmPassword) { setMessage('Passwords do not match.'); return; } delete fields.confirmPassword; try { const { data } = await axios.post(`${API_URL}/auth/${register ? 'register' : 'login'}`, fields); signIn(data.data.token); navigate(location.state?.returnTo || '/'); } catch (error) { setMessage(error.response?.data?.error?.message || 'The account service is not available yet. Please try again soon.'); } }
  return <main className="auth-page"><div className="auth-card"><span className="section-overline">WELCOME TO THE SHOW</span><h1>{register ? 'Join the club.' : 'Good to see you.'}</h1><p>{register ? 'Create an account to keep all your movie nights in one place.' : 'Sign in to pick up where the previews left off.'}</p><form onSubmit={submit}>{register && <label>Your name<input name="name" autoComplete="name" required minLength="2"/></label>}<label>Email address<input name="email" type="email" autoComplete="email" required/></label><label>Password<input name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} required minLength="8"/></label>{register && <label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" required minLength="8"/></label>}{message && <div className="form-error" role="alert">{message}</div>}<button className="hero-cta full-width">{register ? 'Create account' : 'Sign in'} <ArrowRight size={16}/></button></form><div className="auth-switch">{register ? 'Already have an account?' : 'New to IMovies?'} <Link to={register ? '/login' : '/register'}>{register ? 'Sign in' : 'Create an account'}</Link></div></div></main>;
}

export function BookingsPage() {
  const { token } = useAuth(); const [bookings, setBookings] = useState(() => token ? null : []); const [error, setError] = useState('');
  useEffect(() => { if (!token) return; axios.get(`${API_URL}/bookings/my`, { headers: { Authorization: `Bearer ${token}` } }).then(({ data }) => setBookings(data.data?.bookings || [])).catch(() => { setError('We could not load your bookings right now.'); setBookings([]); }); }, [token]);
  async function cancelBooking(id) { try { await axios.post(`${API_URL}/bookings/${id}/cancel`, {}, { headers: { Authorization: `Bearer ${token}` } }); setBookings((current) => current.map((booking) => booking._id === id ? { ...booking, status: 'cancelled' } : booking)); } catch (cancelError) { setError(cancelError.response?.data?.error?.message || 'Could not cancel this booking.'); } }
  return <main className="bookings-page section-shell"><span className="section-overline">YOUR MOVIE NIGHTS</span><h1>My bookings<span className="title-period">.</span></h1>{bookings === null ? <p>Loading your bookings…</p> : bookings.length ? <div className="booking-list">{bookings.map((booking) => <article key={booking._id} className="booking-item"><Ticket/><div><strong>{booking.movie?.title || 'Movie ticket'}</strong><p>{booking.cinema?.name} · {new Date(booking.show?.startsAt).toLocaleString()}</p><span>{booking.seats?.join(', ')} · {booking.reference} · {booking.status}</span></div><b>₹{booking.totalAmount}</b>{booking.status === 'confirmed' && <button className="cancel-booking" onClick={() => cancelBooking(booking._id)}>Cancel</button>}</article>)}</div> : <div className="empty-state"><Ticket size={30}/><h3>{error ? 'Bookings unavailable' : 'No bookings yet'}</h3><p>{error || 'Your next great night out is just a few clicks away.'}</p><Link className="text-button" to="/">Explore movies</Link></div>}{error && bookings?.length > 0 && <p className="form-error" role="alert">{error}</p>}</main>;
}

export function SeatPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const showId = searchParams.get('showId');
  return <SeatSelection key={showId || 'no-show'} id={id} showId={showId} showTime={searchParams.get('show') || 'Select seats'}/>;
}

function SeatSelection({ id, showId, showTime }) {
  const location = useLocation();
  const navigate = useNavigate();
  const storageKey = seatSelectionStorageKey();
  const [movie, setMovie] = useState(() => sampleMovies.find((item) => item.id === id) || sampleMovies[0]);
  const [selected, setSelected] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
      return saved?.showId === showId && Array.isArray(saved.seats) ? saved.seats.filter((seat) => typeof seat === 'string') : [];
    } catch { return []; }
  });
  const [booked, setBooked] = useState([]);
  const [price, setPrice] = useState(null);
  const [capacity, setCapacity] = useState(60);
  const [availabilityReady, setAvailabilityReady] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const rows = Array.from({ length: Math.ceil(capacity / 10) }, (_, index) => seatRowName(index));

  useEffect(() => {
    let active = true;
    axios.get(`${API_URL}/movies/${id}`).then(({ data }) => {
      const found = data.data?.movie;
      if (active && found) setMovie({ ...found, id: found.slug || found._id, poster: found.posterUrl });
    }).catch(() => {});
    return () => { active = false; };
  }, [id]);

  const refreshAvailability = useCallback(async () => {
    if (!showId) return;
    try {
      const { data } = await axios.get(`${API_URL}/shows/${showId}/availability`);
      const unavailableSeats = Array.isArray(data.data?.bookedSeats) ? data.data.bookedSeats : [];
      setBooked(unavailableSeats);
      setPrice(data.data?.ticketPrice ?? null);
      setCapacity(data.data?.capacity || 60);
      setSelected((current) => keepAvailableSeats(current, unavailableSeats));
      setAvailabilityReady(true);
      setError('');
    } catch {
      setAvailabilityReady(false);
      setError('Could not load live seat availability. Go back and choose a current show.');
    }
  }, [showId]);

  useEffect(() => {
    if (!showId) return undefined;
    const initialRefresh = setTimeout(refreshAvailability, 0);
    const timer = setInterval(refreshAvailability, 30000);
    return () => { clearTimeout(initialRefresh); clearInterval(timer); };
  }, [showId, refreshAvailability]);

  useEffect(() => {
    sessionStorage.setItem(storageKey, JSON.stringify({ showId, seats: selected }));
  }, [selected, showId, storageKey]);

  function toggle(seat) {
    setSelected((current) => {
      const next = toggleSeatSelection(current, seat, booked);
      if (next === current && !current.includes(seat) && !booked.includes(seat) && current.length >= 8) {
        setError('You can reserve up to 8 seats in one booking.');
      } else if (next !== current) setError('');
      return next;
    });
  }

  async function book() {
    if (!showId || !selected.length || selected.some((seat) => booked.includes(seat)) || submitting) return;
    const token = localStorage.getItem('imovies-token');
    if (!token) {
      sessionStorage.setItem(storageKey, JSON.stringify({ showId, seats: selected }));
      navigate('/login', { state: { returnTo: seatBookingReturnTo(id, `${location.search}`) } });
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const confirmationPath = await submitSeatBooking({ showId, seats: selected, token, createBooking: (payload, config) => axios.post(`${API_URL}/bookings`, payload, config) });
      sessionStorage.removeItem(storageKey);
      navigate(confirmationPath);
    } catch (err) {
      const bookingError = err.response?.data?.error?.message || 'We couldn’t reserve those seats. Refresh availability and try again.';
      await refreshAvailability();
      setError(bookingError);
    } finally { setSubmitting(false); }
  }

  return <main className="seats-page section-shell"><Link to={`/movie/${movie.id}`} className="back-link">← Back to showtimes</Link><div className="seat-heading"><span className="section-overline">THE BEST PART OF GOING OUT</span><h1>Pick your seats<span className="title-period">.</span></h1><p>{movie.title} <i/> {showTime}</p></div><div className="seat-layout"><div className="seat-stage"><div className="screen"><span>SCREEN</span></div>{!availabilityReady && showId && !error && <p className="seat-loading" role="status">Loading seat availability…</p>}<div className="seat-grid" aria-label="Cinema seating plan">{rows.map((row, rowIndex) => <div className="seat-row" key={row}><span className="seat-row-label">{row}</span>{Array.from({ length: Math.min(10, capacity - rowIndex * 10) }, (_, i) => `${row}${i + 1}`).map((seat) => { const isBooked = booked.includes(seat); const isSelected = selected.includes(seat); return <button key={seat} type="button" aria-label={`Seat ${seat}, ${isBooked ? 'booked' : isSelected ? 'selected' : 'available'}`} aria-pressed={isSelected} disabled={isBooked || !availabilityReady || price === null} onClick={() => toggle(seat)} className={`seat ${isBooked ? 'booked' : isSelected ? 'chosen' : ''}`}><span>{seat.slice(1)}</span></button>; })}</div>)}</div><div className="seat-legend"><span><i/> Available</span><span><i className="chosen"/> Selected</span><span><i className="booked"/> Booked</span><button type="button" className="refresh-seats" onClick={refreshAvailability} disabled={!showId}>Refresh availability</button></div></div><aside className="seat-summary"><span className="section-overline">YOUR TICKETS</span><h3>{movie.title}</h3><p>{selected.length} seat{selected.length === 1 ? '' : 's'} selected</p><div className="summary-rule"/><div className="price-line"><span>{selected.join(', ') || 'Choose seats'} {selected.length && price !== null ? `× ₹${price}` : ''}</span><strong>₹{getSeatTotal(selected, price)}</strong></div>{!showId && <div className="form-error" role="alert">Choose a showtime before selecting seats.</div>}{error && <div className="form-error" role="alert">{error}</div>}<button className="hero-cta full-width" disabled={!selected.length || !availabilityReady || price === null || !showId || submitting || selected.some((seat) => booked.includes(seat))} onClick={book}>{submitting ? 'Reserving…' : 'Continue to booking'} <ArrowRight size={16}/></button><small>Reservation only. Online payment is not enabled; pay at the cinema.</small></aside></div></main>;
}

export function ConfirmationPage() {
  const { id } = useParams(); const { token } = useAuth(); const [booking, setBooking] = useState(null); const [error, setError] = useState(() => token ? '' : 'Sign in to verify this booking.');
  useEffect(() => { if (!token) return; axios.get(`${API_URL}/bookings/${id}`, { headers: { Authorization: `Bearer ${token}` } }).then(({ data }) => setBooking(data.data.booking)).catch(() => setError('We could not verify this booking. Check My Bookings or sign in to the account that made it.')); }, [id, token]);
  return <main className="confirmation-page">{booking ? <><span className="confirmation-check">✓</span><span className="section-overline">RESERVATION CONFIRMED</span><h1>Your tickets are<br/>in the <em>bag.</em></h1><p>{booking.movie?.title} · {booking.seats?.join(', ')}</p><p>{booking.cinema?.name} · {booking.show?.startsAt ? new Date(booking.show.startsAt).toLocaleString() : ''}</p><p>Booking reference <strong>{booking.reference}</strong> · Total ₹{booking.totalAmount}</p><p>Online payment is not enabled. Please pay at the cinema.</p><Link to="/bookings" className="hero-cta">View my bookings <ArrowRight size={16}/></Link></> : <><span className="section-overline">BOOKING DETAILS</span><h1>{error ? 'Unable to verify.' : 'Checking your booking…'}</h1>{error && <p role="alert">{error}</p>}<Link to="/bookings" className="hero-cta">My bookings <ArrowRight size={16}/></Link></>}</main>;
}

export function AdminPage() {
  const { token } = useAuth(); const [access, setAccess] = useState(() => localStorage.getItem('imovies-token') ? 'checking' : 'signed-out');
  const [movies, setMovies] = useState([]); const [cinemas, setCinemas] = useState([]); const [shows, setShows] = useState([]); const [bookings, setBookings] = useState([]); const [message, setMessage] = useState(''); const [editingMovie, setEditingMovie] = useState(null); const [editingCinema, setEditingCinema] = useState(null);
  const [selectedCinema, setSelectedCinema] = useState('');
  const refresh = useCallback(async () => { const headers = { Authorization: `Bearer ${token}` }; const [movieResponse, cinemaResponse, showResponse, bookingResponse] = await Promise.all([axios.get(`${API_URL}/movies`), axios.get(`${API_URL}/cinemas`), axios.get(`${API_URL}/shows`), axios.get(`${API_URL}/bookings/admin/all`, { headers })]); const cinemaItems = cinemaResponse.data.data.cinemas; setMovies(movieResponse.data.data.movies); setCinemas(cinemaItems); setSelectedCinema((current) => current || cinemaItems[0]?._id || ''); setShows(showResponse.data.data.shows); setBookings(bookingResponse.data.data.bookings); }, [token]);
  useEffect(() => { if (!token) return; axios.get(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }).then(async ({ data }) => { if (data.data.user.role !== 'admin') { setAccess('forbidden'); return; } setAccess('admin'); try { await refresh(); } catch { setMessage('Could not load the admin data. Check the database connection and try again.'); } }).catch(() => setAccess('forbidden')); }, [token, refresh]);
  async function createMovie(event) { event.preventDefault(); const form = Object.fromEntries(new FormData(event.currentTarget)); form.duration = Number(form.duration); form.rating = Number(form.rating || 0); try { await axios.post(`${API_URL}/movies`, form, { headers: { Authorization: `Bearer ${token}` } }); event.currentTarget.reset(); setMessage('Movie added.'); await refresh(); } catch (error) { setMessage(error.response?.data?.error?.message || 'Could not add the movie.'); } }
  async function createCinema(event) { event.preventDefault(); const form = Object.fromEntries(new FormData(event.currentTarget)); const screens = [{ name: form.screenName, capacity: Number(form.capacity) }]; delete form.screenName; delete form.capacity; try { await axios.post(`${API_URL}/cinemas`, { ...form, screens }, { headers: { Authorization: `Bearer ${token}` } }); event.currentTarget.reset(); setMessage('Cinema added.'); await refresh(); } catch (error) { setMessage(error.response?.data?.error?.message || 'Could not add the cinema.'); } }
  async function createShow(event) { event.preventDefault(); const form = Object.fromEntries(new FormData(event.currentTarget)); const movie = movies.find((item) => item._id === form.movie); const startsAt = new Date(form.startsAt); const endsAt = new Date(startsAt.getTime() + ((movie?.duration || 120) + 25) * 60000); try { await axios.post(`${API_URL}/shows`, { ...form, startsAt, endsAt, ticketPrice: Number(form.ticketPrice) }, { headers: { Authorization: `Bearer ${token}` } }); event.currentTarget.reset(); setMessage('Show added.'); await refresh(); } catch (error) { setMessage(error.response?.data?.error?.message || 'Could not add the show.'); } }
  async function updateMovie(event) { event.preventDefault(); const form = Object.fromEntries(new FormData(event.currentTarget)); form.duration = Number(form.duration); form.rating = Number(form.rating || 0); try { await axios.patch(`${API_URL}/movies/${editingMovie._id}`, form, { headers: { Authorization: `Bearer ${token}` } }); setEditingMovie(null); setMessage('Movie updated.'); await refresh(); } catch (error) { setMessage(error.response?.data?.error?.message || 'Could not update the movie.'); } }
  async function deactivateMovie(movie) { try { await axios.patch(`${API_URL}/movies/${movie._id}`, { isActive: false }, { headers: { Authorization: `Bearer ${token}` } }); setMessage(`${movie.title} is no longer listed.`); await refresh(); } catch (error) { setMessage(error.response?.data?.error?.message || 'Could not update the movie.'); } }
  async function deleteMovie(movie) { if (!window.confirm(`Permanently delete ${movie.title}? This only works when no show records reference it.`)) return; try { await axios.delete(`${API_URL}/movies/${movie._id}`, { headers: { Authorization: `Bearer ${token}` } }); setMessage('Movie deleted.'); await refresh(); } catch (error) { setMessage(error.response?.data?.error?.message || 'Could not delete the movie.'); } }
  async function updateCinema(event) { event.preventDefault(); const form = Object.fromEntries(new FormData(event.currentTarget)); try { await axios.patch(`${API_URL}/cinemas/${editingCinema._id}`, form, { headers: { Authorization: `Bearer ${token}` } }); setEditingCinema(null); setMessage('Cinema details updated.'); await refresh(); } catch (error) { setMessage(error.response?.data?.error?.message || 'Could not update the cinema.'); } }
  async function deactivateCinema(cinema) { try { await axios.patch(`${API_URL}/cinemas/${cinema._id}`, { isActive: false }, { headers: { Authorization: `Bearer ${token}` } }); setMessage(`${cinema.name} is no longer listed.`); await refresh(); } catch (error) { setMessage(error.response?.data?.error?.message || 'Could not update the cinema.'); } }
  async function updateShowPrice(event, show) { event.preventDefault(); const ticketPrice = Number(new FormData(event.currentTarget).get('ticketPrice')); try { await axios.patch(`${API_URL}/shows/${show._id}`, { ticketPrice }, { headers: { Authorization: `Bearer ${token}` } }); setMessage('Show price updated.'); await refresh(); } catch (error) { setMessage(error.response?.data?.error?.message || 'Could not update the show.'); } }
  async function deactivateShow(show) { try { await axios.patch(`${API_URL}/shows/${show._id}`, { isActive: false }, { headers: { Authorization: `Bearer ${token}` } }); setMessage('Show removed from the public schedule.'); await refresh(); } catch (error) { setMessage(error.response?.data?.error?.message || 'Could not update the show.'); } }
  const effectiveAccess = token ? access : 'signed-out';
  if (effectiveAccess === 'checking') return <main className="admin-page section-shell"><p>Checking administrator access…</p></main>;
  if (effectiveAccess !== 'admin') return <main className="admin-page section-shell"><span className="section-overline">STAFF ONLY</span><h1>Admin dashboard<span className="title-period">.</span></h1><p>{effectiveAccess === 'signed-out' ? 'Sign in with an administrator account to manage the catalogue.' : 'This account does not have administrator access.'}</p><Link to="/login" className="hero-cta">Sign in <ArrowRight size={16}/></Link></main>;
  return <main className="admin-page section-shell"><div className="admin-heading"><div><span className="section-overline">IMOVIES OPERATIONS</span><h1>Admin dashboard<span className="title-period">.</span></h1></div><span className="admin-badge">ADMINISTRATOR</span></div>{message && <div className="admin-message" role="status">{message}<button onClick={() => setMessage('')} aria-label="Dismiss">×</button></div>}<div className="admin-stats"><article><span>ACTIVE MOVIES</span><strong>{movies.length}</strong></article><article><span>CINEMAS</span><strong>{cinemas.length}</strong></article><article><span>UPCOMING SHOWS</span><strong>{shows.length}</strong></article><article><span>BOOKINGS</span><strong>{bookings.length}</strong></article></div><div className="admin-columns"><section className="admin-panel"><span className="section-overline">CATALOGUE</span><h2>Add a movie</h2><form onSubmit={createMovie} className="admin-form"><label>Title<input name="title" required maxLength="140"/></label><label>Slug<input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="film-title"/></label><label>Description<textarea name="description" required maxLength="2000"/></label><div className="admin-form-row"><label>Genre<input name="genre" required/></label><label>Language<input name="language" required/></label></div><div className="admin-form-row"><label>Duration in minutes<input name="duration" type="number" min="1" max="500" required/></label><label>Rating<input name="rating" type="number" min="0" max="10" step="0.1" defaultValue="0"/></label></div><label>Poster URL<input name="posterUrl" type="url" placeholder="https://…"/></label><button className="hero-cta">Add movie <ArrowRight size={14}/></button></form>{editingMovie && <form key={editingMovie._id} onSubmit={updateMovie} className="admin-form edit-form"><h3>Edit {editingMovie.title}</h3><label>Title<input name="title" defaultValue={editingMovie.title} required/></label><label>Slug<input name="slug" defaultValue={editingMovie.slug} required/></label><label>Description<textarea name="description" defaultValue={editingMovie.description} required/></label><div className="admin-form-row"><label>Genre<input name="genre" defaultValue={editingMovie.genre} required/></label><label>Language<input name="language" defaultValue={editingMovie.language} required/></label></div><div className="admin-form-row"><label>Duration<input name="duration" type="number" defaultValue={editingMovie.duration} required/></label><label>Rating<input name="rating" type="number" min="0" max="10" step="0.1" defaultValue={editingMovie.rating}/></label></div><label>Poster URL<input name="posterUrl" type="url" defaultValue={editingMovie.posterUrl}/></label><div className="admin-form-row"><button className="hero-cta">Save changes</button><button type="button" className="text-button" onClick={() => setEditingMovie(null)}>Cancel</button></div></form>}<div className="admin-table">{movies.map((movie) => <div key={movie._id}><span>{movie.title}<small>{movie.genre} · {movie.language}</small></span><div className="admin-row-actions"><button onClick={() => setEditingMovie(movie)}>Edit</button>{movie.isActive && <button onClick={() => deactivateMovie(movie)}>Deactivate</button>}<button onClick={() => deleteMovie(movie)}>Delete</button></div></div>)}</div></section><section className="admin-panel"><span className="section-overline">CINEMAS</span><h2>Add a cinema</h2><form onSubmit={createCinema} className="admin-form"><label>Name<input name="name" required/></label><label>City<input name="city" required/></label><label>Address<input name="address" required/></label><div className="admin-form-row"><label>Screen name<input name="screenName" defaultValue="Screen 1" required/></label><label>Seat capacity<input name="capacity" type="number" min="1" max="500" defaultValue="60" required/></label></div><button className="hero-cta">Add cinema <ArrowRight size={14}/></button></form>{editingCinema && <form key={editingCinema._id} onSubmit={updateCinema} className="admin-form edit-form"><h3>Edit {editingCinema.name}</h3><label>Name<input name="name" defaultValue={editingCinema.name} required/></label><label>City<input name="city" defaultValue={editingCinema.city} required/></label><label>Address<input name="address" defaultValue={editingCinema.address} required/></label><div className="admin-form-row"><button className="hero-cta">Save changes</button><button type="button" className="text-button" onClick={() => setEditingCinema(null)}>Cancel</button></div></form>}<div className="admin-table">{cinemas.map((cinema) => <div key={cinema._id}><span>{cinema.name}<small>{cinema.city} · {cinema.screens?.length} screen(s)</small></span><div className="admin-row-actions"><button onClick={() => setEditingCinema(cinema)}>Edit</button><button onClick={() => deactivateCinema(cinema)}>Deactivate</button></div></div>)}</div></section></div><section className="admin-panel show-admin"><span className="section-overline">SCHEDULE</span><h2>Schedule a show</h2><form onSubmit={createShow} className="admin-form admin-show-form"><label>Movie<select name="movie" required>{movies.filter((movie) => movie.isActive).map((movie) => <option value={movie._id} key={movie._id}>{movie.title}</option>)}</select></label><label>Cinema<select name="cinema" value={selectedCinema} onChange={(event) => setSelectedCinema(event.target.value)} required>{cinemas.filter((cinema) => cinema.isActive).map((cinema) => <option value={cinema._id} key={cinema._id}>{cinema.name}</option>)}</select></label><label>Screen<select name="screen" required>{cinemas.find((cinema) => cinema._id === selectedCinema)?.screens?.map((screen) => <option key={screen.name}>{screen.name}</option>)}</select></label><label>Start time<input name="startsAt" type="datetime-local" required/></label><label>Ticket price (₹)<input name="ticketPrice" type="number" min="0" required/></label><button className="hero-cta">Schedule show <ArrowRight size={14}/></button></form><div className="admin-table">{shows.slice(0, 12).map((show) => <div key={show._id}><span>{show.movie?.title} · {show.cinema?.name}<small>{new Date(show.startsAt).toLocaleString()} · {show.bookedSeats?.length || 0}/{show.capacity} seats</small></span><form className="show-price-form" onSubmit={(event) => updateShowPrice(event, show)}><label className="visually-hidden" htmlFor={`price-${show._id}`}>Ticket price</label><input id={`price-${show._id}`} name="ticketPrice" type="number" min="0" defaultValue={show.ticketPrice}/><button>Save price</button></form><button onClick={() => deactivateShow(show)}>Remove show</button></div>)}</div></section><section className="admin-panel"><span className="section-overline">SALES</span><h2>Recent bookings</h2><div className="admin-table">{bookings.slice(0, 20).map((booking) => <div key={booking._id}><span>{booking.movie?.title} · {booking.user?.name}<small>{booking.reference} · {booking.seats?.join(', ')} · {booking.status}</small></span><strong>₹{booking.totalAmount}</strong></div>)}</div></section></main>;
}
